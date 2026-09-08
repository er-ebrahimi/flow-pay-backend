import { Test } from '@nestjs/testing';

import type { PrismaDb } from '../prisma/prisma.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionsService } from './transactions.service.js';
import { ListTransactionsQueryDto } from './dto/transactions.dto.js';

const USER_A = crypto.randomUUID();
const OTHER_USER = crypto.randomUUID();

interface Fixture {
  id: string;
  quoteId: string | null;
  type: 'EXCHANGE';
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  userId: string;
  createdAt: string;
  fromCurrency: string;
  toCurrency: string;
  sourceAmount: string;
  fee: string;
  exchangeRate: string;
  destinationAmount: string;
}

function row(overrides: Partial<Fixture>): Fixture {
  return {
    id: crypto.randomUUID(),
    quoteId: null,
    type: 'EXCHANGE',
    status: 'COMPLETED',
    userId: USER_A,
    createdAt: new Date('2026-01-02T00:00:00Z').toISOString(),
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    sourceAmount: '100.000000',
    fee: '0.750000',
    exchangerate: '0.8512',
    destinationAmount: '84.480000',
    ...overrides,
  };
}

function dbFor(rows: Fixture[]): PrismaDb {
  return {
    orm: {
      public: {
        Transaction: {
          where: () => ({ all: () => Promise.resolve(rows) }),
          first: (filter: { id: string }) =>
            Promise.resolve(rows.find((row) => row.id === filter.id) ?? null),
        },
        Currency: {
          all: () => Promise.resolve([
            { code: 'USD', name: 'US Dollar', decimalPlaces: 2 },
            { code: 'EUR', name: 'Euro', decimalPlaces: 2 },
          ]),
        },
      },
    },
  } as unknown as PrismaDb;
}

async function serviceFor(db: PrismaDb): Promise<TransactionsService> {
  const moduleRef = await Test.createTestingModule({
    providers: [TransactionsService, { provide: PrismaService, useValue: { db } }],
  }).compile();
  return moduleRef.get(TransactionsService);
}

describe('TransactionsService.list', () => {
  it('pages newest-first with per-currency formatted amounts', async () => {
    const older = { createdAt: new Date('2026-01-01T00:00:00Z').toISOString(), destinationAmount: '10.000000' };
    const newer = { createdAt: new Date('2026-01-05T00:00:00Z').toISOString() };
    // Deliberately out of chronological order to exercise the sort.
    const rows = [
      createRow({ id: crypto.randomUUID(), createdAt: older.createdAt, destinationAmount: '10.000000' }),
      createRow({ id: crypto.randomUUID(), createdAt: newer.createdAt }),
    ];
    const service = await serviceFor(dbFor(rows));

    const result = await service.list(USER_A, assign({}));

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.items[0].id).toEqual(rows[1].id);
    // items[0] is the NEWEST row (default dest), items[1] carries the pinned 10.00.
    expect(result.items[1].destinationAmount).toBe('10.00');
    expect(result.items[0].destinationAmount).toBe('84.48');
    expect(result.items[0].sourceAmount).toBe('100.00');
  });

  it('caps the limit silently per the documented contract policy', async () => {
    const manyRows = Array.from({ length: 250 }, () => createRow({}));
    const service = await serviceFor(dbFor(manyRows));

    const result = await service.list(USER_A, assign({ limit: 1000 }));

    expect(result.limit).toBe(100);
    expect(result.items).toHaveLength(100);
  });

  it('filters by both sides of the currency pair', async () => {
    const rows = [
      createRow({ fromCurrency: 'USD', toCurrency: 'EUR' }),
      createRow({ fromCurrency: 'GBP', toCurrency: 'EUR' }),
      createRow({ fromCurrency: 'EUR', toCurrency: 'GBP' }),
    ];
    const service = await serviceFor(dbFor(rows));

    const result = await service.list(USER_A, assign({ currency: 'USD' }));

    expect(result.total).toBe(1);
  });

  it('matches search by id prefix only', async () => {
    const service = await serviceFor(dbFor([createRow({ id: 'db4180cc-4ff2-4be9-bbe8-2e6ee34fbedc' })]));

    const ok = await service.list(USER_A, assign({ search: 'DB41' }));
    const miss = await service.list(USER_A, assign({ search: 'zzz' }));

    expect(ok.total).toBe(1);
    expect(miss.total).toBe(0);
  });
});

describe('TransactionsService.findOne', () => {
  it('returns fee/rate/quoteId with rendered amounts', async () => {
    const row = {
      id: crypto.randomUUID(),
      createdAt: '2026-01-02T00:00:00.000Z',
      quoteId: 'quote-id',
      fee: '0.750000',
      exchangeRate: '0.8512000000',
      sourceAmount: '100.000000',
      destinationAmount: '84.480000',
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      status: 'COMPLETED',
      userId: USER_A,
      type: 'EXCHANGE',
    } as const;
    const service = await serviceFor(dbFor([row]));

    const result = await service.findOne(USER_A, row.id);

    expect(result).toMatchObject({
      fee: '0.75',
      rate: '0.8512',
      quoteId: row.quoteId,
      sourceAmount: '100.00',
    });
  });

  it('gives the identical NOT_FOUND whether the id is unknown or foreign-owned', async () => {
    const foreign = { id: crypto.randomUUID(), userId: OTHER_USER } as unknown as Fixture;
    const service = await serviceFor(dbFor([foreign]));

    await expect(service.findOne(USER_A, foreign.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      context: { transactionId: foreign.id },
    });
    await expect(service.findOne(USER_A, crypto.randomUUID())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

function createRow(overrides: Partial<Fixture>): Fixture {
  return { ...row({}), ...overrides };
}

function assign(overrides: Partial<ListTransactionsQueryDto>): ListTransactionsQueryDto {
  return Object.assign(new ListTransactionsQueryDto(), overrides);
}
