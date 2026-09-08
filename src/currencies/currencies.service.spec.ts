import { Test } from '@nestjs/testing';

import { CurrenciesService } from './currencies.service.js';
import { ExcludeCurrencyQueryDto } from './dto/currencies.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PrismaDb } from '../prisma/prisma.service.js';

interface CurrencyRow {
  code: string;
  name: string;
  decimalPlaces: number;
  wallets: number;
}

const SEEDED: CurrencyRow[] = [
  { code: 'USD', name: 'US Dollar', decimalPlaces: 2, wallets: 3 },
  { code: 'EUR', name: 'Euro', decimalPlaces: 2, wallets: 1 },
  { code: 'GBP', name: 'British Pound', decimalPlaces: 2, wallets: 0 },
  { code: 'AED', name: 'UAE Dirham', decimalPlaces: 2, wallets: 2 },
];

function dbFor(rows: CurrencyRow[]): PrismaDb {
  return {
    orm: {
      public: {
        Currency: {
          include: () => ({ all: () => Promise.resolve(rows) }),
        },
      },
    },
  } as unknown as PrismaDb;
}

async function serviceFor(rows: CurrencyRow[]): Promise<CurrenciesService> {
  const moduleRef = await Test.createTestingModule({
    providers: [CurrenciesService, { provide: PrismaService, useValue: { db: dbFor(rows) } }],
  }).compile();
  return moduleRef.get(CurrenciesService);
}

describe('CurrenciesService', () => {
  it('returns all currencies sorted by code with the included wallet count', async () => {
    const service = await serviceFor(SEEDED);

    const result = await service.findAll();

    expect(result.map((row) => row.code)).toEqual(['AED', 'EUR', 'GBP', 'USD']);
    expect(result.find((row) => row.code === 'USD')).toMatchObject({
      name: 'US Dollar',
      decimalPlaces: 2,
      walletCount: 3,
    });
  });

  it('excludes the requested currency from the list', async () => {
    const service = await serviceFor(SEEDED);

    const result = await service.findAll(query('USD'));

    expect(result.map((row) => row.code)).toEqual(['AED', 'EUR', 'GBP']);
  });

  it('accepts a well-formed but unknown exclude code as a no-op filter', async () => {
    const service = await serviceFor(SEEDED);

    const result = await service.findAll(query('USA'));

    expect(result).toHaveLength(4);
  });

  it('reports zero walletCount when no wallets exist for a currency', async () => {
    const service = await serviceFor(SEEDED);

    const gbp = await service.findAll();

    expect(gbp.find((row) => row.code === 'GBP')).toMatchObject({ walletCount: 0 });
  });
});

function query(exclude: string): ExcludeCurrencyQueryDto {
  return Object.assign(new ExcludeCurrencyQueryDto(), { exclude });
}
