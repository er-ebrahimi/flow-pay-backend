import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import type { PrismaDb } from '../prisma/prisma.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RatesService } from '../rates/rates.service.js';
import { InsufficientFundsException } from './exchange.exceptions.js';
import { QuotesService } from './quotes.service.js';
import { CreateQuoteDto } from './dto/exchange.dto.js';

const USER = '11111111-1111-4111-8111-111111111111';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', decimalPlaces: 2 },
];

function dbFor(options: { balance?: string; wallet?: boolean }): PrismaDb {
  return {
    orm: {
      public: {
        Currency: {
          all: () => Promise.resolve(CURRENCIES),
        },
        Wallet: {
          first: (_filter: unknown) =>
            Promise.resolve(options.wallet === false ? null : { balance: options.balance ?? '100.000000' }),
        },
        ExchangeQuote: {
          create: (data: Record<string, unknown>) => Promise.resolve({ id: 'quote-1', amount: data.amount, fee: data.fee }),
        },
      },
    },
  } as unknown as PrismaDb;
}

async function serviceFor(db: PrismaDb): Promise<QuotesService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      QuotesService,
      { provide: PrismaService, useValue: { db } },
      { provide: RatesService, useValue: { getActiveRate: () => Promise.resolve({ rate: '0.8512', asOf: 'x' }) } },
      { provide: ConfigService, useValue: { get: () => '0.0075' } },
    ],
    imports: [],
  }).compile();
  return moduleRef.get(QuotesService);
}

function quote(from = 'USD', to = 'EUR', amount = '1000.00'): CreateQuoteDto {
  return Object.assign(new CreateQuoteDto(), { fromCurrency: from, toCurrency: to, amount });
}

describe('QuotesService.createQuote', () => {
  it('locks the rate, computes fee and destination with half-up rounding', async () => {
    const service = await serviceFor(dbFor({ balance: '1000.000000' }));

    const response = await service.createQuote(USER, quote());

    expect(response).toMatchObject({
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      amount: '1000.00',
      fee: '7.50',
      destinationAmount: '844.82',
      rate: '0.8512',
    });
    expect(new Date(response.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a same-currency quote with SAME_CURRENCY validation', async () => {
    const service = await serviceFor(dbFor({}));

    await expect(service.createQuote(USER, quote('EUR', 'EUR'))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      context: { reason: 'SAME_CURRENCY' },
    });
  });

  it('rejects amounts violating the source currency precision', async () => {
    const service = await serviceFor(dbFor({ balance: '1000.000000' }));

    await expect(service.createQuote(USER, quote('USD', 'EUR', '10.500'))).rejects.toMatchObject({
      context: { reason: 'INVALID_AMOUNT' },
    });
  });

  it('422s with INSUFFICIENT_BALANCE when the wallet cannot fund the quote', async () => {
    const service = await serviceFor(dbFor({ balance: '500.000000' }));

    await expect(service.createQuote(USER, quote())).rejects.toBeInstanceOf(InsufficientFundsException);
  });
});
