import { Test } from '@nestjs/testing';

import type { PrismaDb } from '../prisma/prisma.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RatesService } from './rates.service.js';

const USD_EUR_ROW = { rate: '0.8512000000', validFrom: '2000-01-01T00:00:00Z', validTo: '9999-12-31T23:59:59.999Z' };

function dbForStored(rows: Array<{ rate: string; validFrom: string; validTo: string }>): PrismaDb {
  return {
    orm: {
      public: {
        ExchangeRate: {
          where: () => ({ all: () => Promise.resolve(rows) }),
          create: (data: { rate: { toString: () => string } }) =>
            Promise.resolve({ id: 'new-rate-id', rate: data.rate.toString() }),
        },
      },
    },
  } as unknown as PrismaDb;
}

async function serviceFor(
  rows: Array<{ rate: string; validFrom: string; validTo: string }>,
): Promise<RatesService> {
  const moduleRef = await Test.createTestingModule({
    providers: [RatesService, { provide: PrismaService, useValue: { db: dbForStored(rows) } }],
  }).compile();
  return moduleRef.get(RatesService);
}

describe('RatesService.getActiveRate', () => {
  it('returns the newest active rate for the pair', async () => {
    const service = await serviceFor([
      USD_EUR_ROW,
      { rate: '0.8612000000', validFrom: '2026-09-08T00:00:00Z', validTo: '9999-12-31T23:59:59.999Z' },
    ]);

    const result = await service.getActiveRate('USD', 'EUR');

    expect(result).toEqual({ rate: '0.8612', asOf: '2026-09-08T00:00:00.000Z' });
  });

  it('ignores expired rows and picks the newest still-active one', async () => {
    const service = await serviceFor([
      { rate: '0.9000000000', validFrom: '2020-01-01T00:00:00Z', validTo: '2020-12-31T00:00:00Z' },
      { rate: '0.8512000000', validFrom: '2026-01-01T00:00:00Z', validTo: '9999-12-31T23:59:59.999Z' },
    ]);

    const result = await service.getActiveRate('USD', 'EUR');

    expect(result.rate).toBe('0.8512');
  });

  it('404s when no active row covers now', async () => {
    const service = await serviceFor([
      { rate: '0.9000000000', validFrom: '2020-01-01T00:00:00Z', validTo: '2020-12-31T00:00:00Z' },
    ]);

    await expect(service.getActiveRate('USD', 'EUR')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('404s when the pair has no rows at all', async () => {
    const service = await serviceFor([]);
    await expect(service.getActiveRate('GBP', 'EUR')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('RatesService.setRate', () => {
  it('inserts a new row and returns it rendered at stored precision', async () => {
    const service = await serviceFor([USD_EUR_ROW]);

    const result = await service.setRate({
      base: 'USD',
      quote: 'EUR',
      rate: '0.8612',
      validFrom: '2026-09-08T00:00:00Z',
      validTo: '9999-12-31T23:59:59Z',
    });

    expect(result).toEqual({
      id: 'new-rate-id',
      base: 'USD',
      quote: 'EUR',
      rate: '0.8612',
      validFrom: '2026-09-08T00:00:00.000Z',
      validTo: '9999-12-31T23:59:59.000Z',
    });
  });

  it('accepts a high-precision rate and renders it back without trailing zeros', async () => {
    const service = await serviceFor([]);

    const result = await service.setRate({
      base: 'GBP',
      quote: 'EUR',
      rate: '1.1700000000',
      validFrom: '2026-09-08T00:00:00Z',
      validTo: '9999-12-31T23:59:59Z',
    });

    expect(result.rate).toBe('1.17');
  });
});
