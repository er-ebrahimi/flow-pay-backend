import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service.js';
import { RatesService } from '../rates/rates.service.js';
import { Money } from '../shared/money/money.js';
import { money6, rate10 } from '../shared/money/numeric.js';
import { NotFoundException, ValidationException } from '../error-handling/errors/domain.exceptions.js';
import { InsufficientFundsException } from './exchange.exceptions.js';
import type { CreateQuoteDto, ExchangeQuoteResponseDto } from './dto/exchange.dto.js';

interface CurrencyRow {
  code: string;
  decimalPlaces: number;
}

interface QuoteRow {
  id: string;
  amount: string;
  fee: string;
  lockedRate: string;
  expiresAt: string;
}

@Injectable()
export class QuotesService {
  static readonly QUOTE_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ratesService: RatesService,
    private readonly config: ConfigService,
  ) {}

  async createQuote(userId: string, dto: CreateQuoteDto): Promise<ExchangeQuoteResponseDto> {
    // Business validation that needs DB facts — class-validator cannot do it.
    if (dto.fromCurrency === dto.toCurrency) {
      throw new ValidationException('fromCurrency and toCurrency must differ', { reason: 'SAME_CURRENCY' });
    }

    const currencies = (await this.prisma.db.orm.public.Currency.all()) as CurrencyRow[];
    const from = currencies.find((row) => row.code === dto.fromCurrency);
    const to = currencies.find((row) => row.code === dto.toCurrency);
    if (from === undefined || to === undefined) {
      throw new NotFoundException('currency not found', {
        currencyCode: from === undefined ? dto.fromCurrency : dto.toCurrency,
      });
    }

    // Wrong precision is an input error — UI amounts follow the source
    // currency scale so fee math stays exact.
    const amount = Money.from(dto.amount, from.decimalPlaces);
    if (amount === null || amount.isZero() || amount.isNegative() || hasMoreFractionDigits(dto.amount, from.decimalPlaces)) {
      throw new ValidationException('amount must be positive and match the currency precision', {
        reason: 'INVALID_AMOUNT',
      });
    }

    const wallet = (await this.prisma.db.orm.public.Wallet.first({
      userId,
      currencyCode: dto.fromCurrency,
    })) as unknown as { balance: string } | null;
    // Funding check happens at quote time: the user gets sent straight back
    // to the amount screen instead of discovering it on confirm.
    if (wallet === null) {
      throw new InsufficientFundsException('no wallet for this currency', {
        currencyCode: dto.fromCurrency,
      });
    }
    const balance = Money.from(wallet.balance, from.decimalPlaces)!;
    if (balance.isLessThan(amount)) {
      throw new InsufficientFundsException('insufficient balance', { currencyCode: dto.fromCurrency });
    }

    const { rate } = await this.ratesService.getActiveRate(dto.fromCurrency, dto.toCurrency);
    const feeRate = this.config.get<string>('EXCHANGE_FEE_PCT', '0.0075');
    // Canonical exchange math: fee is charged in the source currency, then the
    // remainder converts at the locked rate (see docs/API_CONTRACT.md — the
    // example figures predate this formula and were never self-consistent).
    const fee = amount.multiply(feeRate).roundTo(from.decimalPlaces);
    const net = amount.subtract(fee);
    const destinationAmount = net.multiply(rate).roundTo(to.decimalPlaces);
    // Quoted at creation time; confirm() re-checks and rejects expired ones.
    const expiresAt = new Date(Date.now() + QuotesService.QUOTE_TTL_SECONDS * 1000);

    const inserted = (await this.prisma.db.orm.public.ExchangeQuote.create({
      userId,
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      amount: money6(amount.toDecimalString()),
      fee: money6(fee.toDecimalString()),
      lockedRate: rate10(rate),
      expiresAt: expiresAt.toISOString(),
    })) as QuoteRow;

    return {
      quoteId: inserted.id,
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      amount: amount.toDecimalString(),
      fee: fee.toDecimalString(),
      rate,
      destinationAmount: destinationAmount.toDecimalString(),
      expiresAt: expiresAt.toISOString(),
    };
  }
}

function hasMoreFractionDigits(amount: string, decimalPlaces: number): boolean {
  return (amount.split('.')[1] ?? '').length > decimalPlaces;
}
