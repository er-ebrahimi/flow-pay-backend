import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '../error-handling/errors/domain.exceptions.js';
import { renderBalance } from '../wallets/balance.mapper.js';
import { renderRate } from '../rates/rate-string.mapper.js';
import {
  ListTransactionsQueryDto,
  TransactionDetailDto,
  TransactionItemDto,
} from './dto/transactions.dto.js';

interface RawTransactionRow {
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

interface CurrencyRow {
  code: string;
  decimalPlaces: number;
}

/** Silent clamping is a stated contract rule: ask for 1,000 → get 100. */
const LIMIT_CAP = 100;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<{ items: TransactionItemDto[]; page: number; limit: number; total: number }> {
    const page = query.page ?? 1;
    const limit = Math.max(1, Math.min(query.limit ?? 20, LIMIT_CAP));
    const scales = await this.currencyScales();

    // User-scoped single read: a user's own history is bounded by their own
    // activity, so filtering and slicing in memory avoids two round-trips.
    const all = (await this.prisma.db.orm.public.Transaction.where({
      userId,
    }).all()) as unknown as (RawTransactionRow & { type: 'EXCHANGE' })[];

    const matches = all
      .filter((row) => this.matchesFilters(row, query))
      .sort((left, right) => {
        const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt);
        return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
      });

    return {
      page,
      limit,
      total: matches.length,
      items: matches.slice((page - 1) * limit, page * limit).map((row) => this.toItem(row, scales)),
    };
  }

  async findOne(userId: string, id: string): Promise<TransactionDetailDto> {
    const row = (await this.prisma.db.orm.public.Transaction.first({ id })) as unknown as RawTransactionRow | null;
    // Ownership-first rule from the contract: the same 404 whether the row is
    // missing or belongs to another user — no existence leak.
    if (row === null || row.userId !== userId) {
      throw new NotFoundException('transaction not found', { transactionId: id });
    }
    return this.toDetail(row, await this.currencyScales());
  }

  private matchesFilters(row: RawTransactionRow, query: ListTransactionsQueryDto): boolean {
    if (query.status !== undefined && row.status !== query.status) return false;
    if (query.currency !== undefined && row.fromCurrency !== query.currency && row.toCurrency !== query.currency) {
      return false;
    }
    const createdAtMs = Date.parse(row.createdAt);
    if (query.dateFrom !== undefined && createdAtMs < Date.parse(query.dateFrom)) return false;
    if (query.dateTo !== undefined && Date.parse(query.dateTo) < createdAtMs) return false;
    if (query.type !== undefined && row.type !== query.type) return false;
    // search matches the id prefix only — users cannot fish for other ids.
    if (query.search !== undefined && row.id.toLowerCase().startsWith(query.search.toLowerCase()) === false) {
      return false;
    }
    return true;
  }

  private async currencyScales(): Promise<Map<string, number>> {
    const currencies = (await this.prisma.db.orm.public.Currency.all()) as CurrencyRow[];
    return new Map(currencies.map((row) => [row.code, row.decimalPlaces]));
  }

  private toItem(row: RawTransactionRow, scales: Map<string, number>): TransactionItemDto {
    const fromScale = scales.get(row.fromCurrency) ?? 2;
    const toScale = scales.get(row.toCurrency) ?? 2;
    return {
      id: row.id,
      type: row.type,
      fromCurrency: row.fromCurrency,
      toCurrency: row.toCurrency,
      sourceAmount: renderBalance(row.sourceAmount, fromScale),
      destinationAmount: renderBalance(row.destinationAmount, toScale),
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private toDetail(row: RawTransactionRow, scales: Map<string, number>): TransactionDetailDto {
    const fromScale = scales.get(row.fromCurrency) ?? 2;
    return {
      ...this.toItem(row, scales),
      fee: renderBalance(row.fee, fromScale),
      rate: renderRate(row.exchangeRate),
      quoteId: row.quoteId,
    };
  }
}
