import { Test } from '@nestjs/testing';

import type { PrismaDb } from '../prisma/prisma.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletsService } from './wallets.service.js';

const USER_ID = crypto.randomUUID();

interface WalletRecord {
  currencyCode: string;
  balance: string;
  createdAt: Date;
  currency: { decimalPlaces: number };
}

interface TransactionRecord {
  fromCurrency: string;
  toCurrency: string;
}

const USD_WALLET: WalletRecord = {
  currencyCode: 'USD',
  balance: '100.000000',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  currency: { decimalPlaces: 2 },
};

function dbFor(wallets: WalletRecord[], transactions: TransactionRecord[]): PrismaDb {
  return {
    orm: {
      public: {
        Wallet: {
          include: () => ({
            where: () => ({ all: () => Promise.resolve(wallets) }),
            first: (filter: { userId: string; currencyCode: string }) =>
              Promise.resolve(
                wallets.find((wallet) => wallet.currencyCode === filter.currencyCode) ?? null,
              ),
          }),
          first: (filter: { userId: string; currencyCode: string }) =>
            Promise.resolve(
              wallets.find((wallet) => wallet.currencyCode === filter.currencyCode) ?? null,
            ),
        },
        Transaction: {
          where: () => ({ all: () => Promise.resolve(transactions) }),
        },
      },
    },
  } as unknown as PrismaDb;
}

async function serviceFor(db: PrismaDb): Promise<WalletsService> {
  const moduleRef = await Test.createTestingModule({
    providers: [WalletsService, { provide: PrismaService, useValue: { db } }],
  }).compile();
  return moduleRef.get(WalletsService);
}

describe('WalletsService', () => {
  it('lists wallets sorted by code with a per-currency formatted balance', async () => {
    const db = dbFor([USD_WALLET, {
      currencyCode: 'AED',
      balance: '401.000000',
      createdAt: new Date(),
      currency: { decimalPlaces: 2 },
    }], []);
    const service = await serviceFor(db);

    const result = await service.findAllForUser(USER_ID);

    expect(result.map((row) => row.currencyCode)).toEqual(['AED', 'USD']);
    expect(result[1].balance).toBe('100.00');
    expect(result[0].balance).toBe('401.00');
  });

  it('counts a transaction for both the source and the destination currency', async () => {
    const transactions: TransactionRecord[] = [
      { fromCurrency: 'USD', toCurrency: 'EUR' },
      { fromCurrency: 'EUR', toCurrency: 'USD' },
      { fromCurrency: 'GBP', toCurrency: 'EUR' },
    ];
    const wallets: WalletRecord[] = [
      USD_WALLET,
      { currencyCode: 'EUR', balance: '0.000000', createdAt: new Date(), currency: { decimalPlaces: 2 } },
      { currencyCode: 'GBP', balance: '0.000000', createdAt: new Date(), currency: { decimalPlaces: 2 } },
    ];
    const service = await serviceFor(dbFor(wallets, transactions));

    const result = await service.findAllForUser(USER_ID);

    expect(result.find((row) => row.currencyCode === 'USD')?.transactionCount).toBe(2);
    expect(result.find((row) => row.currencyCode === 'EUR')?.transactionCount).toBe(3);
    expect(result.find((row) => row.currencyCode === 'GBP')?.transactionCount).toBe(1);
  });

  it('reports zero transaction counts for a fresh wallet', async () => {
    const service = await serviceFor(dbFor([USD_WALLET], []));

    const result = await service.findAllForUser(USER_ID);

    expect(result[0].transactionCount).toBe(0);
  });

  it('throws NOT_FOUND carrying the requested currency code for a missing wallet', async () => {
    const service = await serviceFor(dbFor([], []));

    await expect(service.findByCode(USER_ID, 'EUR')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      context: { currencyCode: 'EUR' },
    });
  });
});
