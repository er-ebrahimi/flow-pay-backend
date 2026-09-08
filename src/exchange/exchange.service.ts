import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { PrismaTransaction } from '../prisma/prisma.service.js';
import { Money } from '../shared/money/money.js';
import { money6, rate10 } from '../shared/money/numeric.js';
import { renderBalance } from '../wallets/balance.mapper.js';
import { ConflictException, NotFoundException } from '../error-handling/errors/domain.exceptions.js';
import {
  InsufficientFundsException,
  QuoteAlreadyConsumedException,
  QuoteExpiredException,
} from './exchange.exceptions.js';
import { isUniqueViolation } from './db-errors.js';
import type { TransactionResultDto } from './dto/exchange.dto.js';

interface QuoteRow {
  id: string;
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  fee: string;
  lockedRate: string;
  expiresAt: string;
  consumedAt: string | null;
}

interface WalletRow {
  currencyCode: string;
  balance: string;
  version: number;
}

interface CurrencyRow {
  code: string;
  decimalPlaces: number;
}

interface TransactionRow {
  id: string;
  createdAt: string;
  status: string;
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  sourceAmount: string;
  fee: string;
  exchangeRate: string;
  destinationAmount: string;
}

const VERSION_CAS_ATTEMPTS = 3;

export interface ConfirmResult {
  result: {
    transactionId: string;
    status: string;
    fromCurrency: string;
    toCurrency: string;
    sourceAmount: string;
    fee: string;
    rate: string;
    destinationAmount: string;
    createdAt: string;
  };
  replayed: boolean;
}

@Injectable()
export class ExchangeService {
  constructor(private readonly prisma: PrismaService) {}

  async confirm(userId: string, idempotencyKey: string, quoteId: string): Promise<ConfirmResult> {
    // Global unique idempotency_key means even another user's row can be the
    // winner; only same-user replays are allowed to see the original result.
    const existing = (await this.prisma.db.orm.public.Transaction.first({
      idempotencyKey,
    })) as unknown as (TransactionRow & { userId: string }) | null;
    if (existing !== null) {
      if (existing.userId !== userId) {
        throw new ConflictException('idempotency key belongs to another user', { idempotencyKey });
      }
      return { result: await this.toResult(existing), replayed: true };
    }

    try {
      const result = await this.prisma.db.transaction((tx) =>
        this.executeInTx(tx, userId, idempotencyKey, quoteId),
      );
      return { result, replayed: false };
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost the idempotency-key insert race. Replay only if *our* request
        // won; two different users sharing one key is a hard conflict.
        const winner = (await this.prisma.db.orm.public.Transaction.first({
          idempotencyKey,
        })) as unknown as (TransactionRow & { userId: string }) | null;
        if (winner === null) throw error;
        if (winner.userId !== userId) {
          throw new ConflictException('idempotency key belongs to another user', { idempotencyKey });
        }
        return { result: await this.toResult(winner), replayed: true };
      }
      throw error;
    }
  }

  private async executeInTx(
    tx: PrismaTransaction,
    userId: string,
    idempotencyKey: string,
    quoteId: string,
  ): Promise<TransactionResultDto> {
    const quote = (await tx.orm.public.ExchangeQuote.first({
      id: quoteId,
      userId,
    })) as unknown as QuoteRow | null;
    // Another user's quote is indistinguishable from a missing one.
    if (quote === null) {
      throw new NotFoundException('quote not found', { quoteId });
    }
    if (quote.consumedAt !== null) {
      throw new QuoteAlreadyConsumedException('quote already used', { quoteId });
    }
    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      throw new QuoteExpiredException('quote expired', { quoteId });
    }

    const currencies = (await tx.orm.public.Currency.all()) as CurrencyRow[];
    const from = currencies.find((row) => row.code === quote.fromCurrency)!;
    const to = currencies.find((row) => row.code === quote.toCurrency)!;

    const amount = Money.from(quote.amount, from.decimalPlaces)!;
    const fee = Money.from(quote.fee, from.decimalPlaces)!;
    const net = amount.subtract(fee);
    const destinationAmount = net.multiply(quote.lockedRate).roundTo(to.decimalPlaces);

    const sourceWallet = (await tx.orm.public.Wallet.first({
      userId,
      currencyCode: quote.fromCurrency,
    })) as unknown as WalletRow | null;
    if (sourceWallet === null) {
      throw new NotFoundException('wallet not found', { currencyCode: quote.fromCurrency });
    }

    // Debit with a version-CAS via updateAndCount — the row count is the only
    // honest signal of a lost race here (plain .update() does not reliably
    // answer "0 rows matched" through the aggregate-map types).
    let sourceReduced = false;
    for (let attempt = 0; attempt < VERSION_CAS_ATTEMPTS && sourceReduced === false; attempt += 1) {
      const balance = Money.from(sourceWallet.balance, from.decimalPlaces)!;
      if (balance.isLessThan(amount)) {
        throw new InsufficientFundsException('insufficient balance during exchange', {
          currencyCode: quote.fromCurrency,
        });
      }
      const updatedCount = await tx.orm.public.Wallet.where({
        userId,
        currencyCode: sourceWallet.currencyCode,
        version: sourceWallet.version,
      }).updateAndCount({
        balance: money6(balance.subtract(amount).toDecimalString()),
        version: sourceWallet.version + 1,
      });
      sourceReduced = updatedCount > 0;
    }
    if (sourceReduced === false) {
      throw new InsufficientFundsException('wallet changed during exchange, retry', {
        currencyCode: quote.fromCurrency,
      });
    }

    // The consumedAt flip is the concurrency fence: updateAndCount tells us
    // exactly whether this confirm was the winner.
    const consumedCount = await tx.orm.public.ExchangeQuote.where({
      id: quote.id,
      consumedAt: null,
    }).updateAndCount({
      consumedAt: new Date().toISOString(),
    });
    if (consumedCount === 0) {
      throw new QuoteAlreadyConsumedException('quote already used', { quoteId });
    }

    // Collecting into a currency the user never held: create the destination
    // wallet seeded with the credited amount (version starts at 0).
    const destinationWallet = (await tx.orm.public.Wallet.first({
      userId,
      currencyCode: quote.toCurrency,
    })) as unknown as WalletRow | null;
    if (destinationWallet === null) {
      await tx.orm.public.Wallet.create({
        userId,
        currencyCode: quote.toCurrency,
        balance: money6(destinationAmount.toDecimalString()),
        version: 0,
      });
    } else {
      // Credit the existing wallet: settle at balance+destinationAmount with
      // half-up normalizations already applied.
      const credited = Money.from(destinationWallet.balance, to.decimalPlaces)!
        .add(destinationAmount);
      const creditedCount = await tx.orm.public.Wallet.where({
        userId,
        currencyCode: quote.toCurrency,
        version: destinationWallet.version,
      }).updateAndCount({
        balance: money6(credited.toDecimalString()),
        version: destinationWallet.version + 1,
      });
      if (creditedCount === 0) {
        throw new InsufficientFundsException('wallet changed during exchange, retry', {
          currencyCode: quote.toCurrency,
        });
      }
    }

    const transaction = (await tx.orm.public.Transaction.create({
      userId,
      quoteId: quote.id,
      type: 'EXCHANGE',
      fromCurrency: quote.fromCurrency,
      toCurrency: quote.toCurrency,
      sourceAmount: money6(amount.toDecimalString()),
      fee: money6(fee.toDecimalString()),
      exchangeRate: rate10(quote.lockedRate),
      destinationAmount: money6(destinationAmount.toDecimalString()),
      status: 'COMPLETED',
      idempotencyKey,
    })) as unknown as TransactionRow;

    return this.toResult(transaction);
  }

  private async toResult(row: TransactionRow): Promise<TransactionResultDto> {
    // Numeric columns echo full scale; render money strings at each side's
    // currency precision so the result body matches the wallets' display.
    const currencies = (await this.prisma.db.orm.public.Currency.all()) as CurrencyRow[];
    const fromScale = currencies.find((currency) => currency.code === row.fromCurrency)?.decimalPlaces ?? 2;
    const toScale = currencies.find((currency) => currency.code === row.toCurrency)?.decimalPlaces ?? 2;
    return {
      transactionId: row.id,
      status: row.status,
      fromCurrency: row.fromCurrency,
      toCurrency: row.toCurrency,
      sourceAmount: renderBalance(row.sourceAmount, fromScale),
      fee: renderBalance(row.fee, fromScale),
      rate: row.exchangeRate,
      destinationAmount: renderBalance(row.destinationAmount, toScale),
      createdAt: row.createdAt,
    };
  }
}
