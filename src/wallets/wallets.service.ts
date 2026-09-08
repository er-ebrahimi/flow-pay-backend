import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '../error-handling/errors/domain.exceptions.js';
import { WalletDto } from './dto/wallet.dto.js';
import { renderBalance } from './balance.mapper.js';

interface WalletRow {
  currencyCode: string;
  balance: string;
  // The contract's TimestamptzString codec returns column values as ISO strings.
  createdAt: string;
  currency: { decimalPlaces: number };
}

interface TransactionRow {
  fromCurrency: string;
  toCurrency: string;
}

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<WalletDto[]> {
    const [walletsRaw, counts] = await Promise.all([
      this.prisma.db.orm.public.Wallet.include('currency')
        .where({ userId })
        .all(),
      this.countTransactionsByCurrency(userId),
    ]);
    const wallets = walletsRaw as unknown as WalletRow[];

    return wallets
      .map((row) => this.toDto(row, counts.get(row.currencyCode) ?? 0))
      .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
  }

  async findByCode(userId: string, currencyCode: string): Promise<WalletDto> {
    const wallet = (await this.prisma.db.orm.public.Wallet.include('currency').first({
      userId,
      currencyCode,
    })) as unknown as WalletRow | null;
    // The contract demands the exact same 404 whether the currency is unknown
    // or the user simply owns no wallet in it — never leak wallet existence.
    if (wallet === null) {
      throw new NotFoundException('wallet not found', { currencyCode });
    }
    return this.toDto(
      wallet,
      await this.countTransactions(userId, currencyCode),
    );
  }

  private toDto(row: WalletRow, transactionCount: number): WalletDto {
    return {
      currencyCode: row.currencyCode,
      balance: renderBalance(row.balance, row.currency.decimalPlaces),
      transactionCount,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  /**
   * Counts per currency where the wallet's currency is the source or the
   * destination — the same cut the wallet page pairs with
   * `GET /transactions?currency=...`.
   */
  private async countTransactionsByCurrency(userId: string): Promise<Map<string, number>> {
    const rows = (await this.prisma.db.orm.public.Transaction.where({
      userId,
    }).all()) as TransactionRow[];
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.fromCurrency, (counts.get(row.fromCurrency) ?? 0) + 1);
      if (row.toCurrency !== row.fromCurrency) {
        counts.set(row.toCurrency, (counts.get(row.toCurrency) ?? 0) + 1);
      }
    }
    return counts;
  }

  /** Detail variant of the count above, one currency at a time. */
  private async countTransactions(userId: string, currencyCode: string): Promise<number> {
    const counts = await this.countTransactionsByCurrency(userId);
    return counts.get(currencyCode) ?? 0;
  }
}
