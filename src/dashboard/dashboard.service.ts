import { Injectable } from '@nestjs/common';

import { WalletsService } from '../wallets/wallets.service.js';
import { RatesService } from '../rates/rates.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { Money } from '../shared/money/money.js';
import { ListTransactionsQueryDto } from '../transactions/dto/transactions.dto.js';
import type { DashboardDto } from './dto/dashboard.dto.js';
import { DASHBOARD_BASE_CURRENCY } from './constants.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly ratesService: RatesService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async get(userId: string): Promise<DashboardDto> {
    const [wallets, recentPage] = await Promise.all([
      this.walletsService.findAllForUser(userId),
      this.transactionsService.list(userId, Object.assign(new ListTransactionsQueryDto(), { page: 1, limit: 5 })),
    ]);

    const rateCache = new Map<string, string | null>();
    const summary = wallets.map((wallet) => ({ currencyCode: wallet.currencyCode, balance: wallet.balance }));
    let total = Money.from('0', 2)!;

    for (const wallet of wallets) {
      const rate = await this.usdRate(wallet.currencyCode, rateCache);
      if (rate === null) {
        // Documented rule: wallets without an active rate to USD are excluded
        // from the total — faking a rate would overstate the user's money.
        continue;
      }
      total = total.add(Money.from(wallet.balance, 2)!.multiply(rate).roundTo(2));
    }

    return {
      totalBalanceBase: total.toDecimalString(),
      baseCurrency: DASHBOARD_BASE_CURRENCY,
      wallets: summary,
      recentTransactions: recentPage.items as unknown as Array<Record<string, unknown>>,
    };
  }

  /** currency→USD rate; cached per request so N wallets hit the DB once. */
  private async usdRate(currencyCode: string, cache: Map<string, string | null>): Promise<string | null> {
    if (currencyCode === DASHBOARD_BASE_CURRENCY) return '1';
    if (cache.has(currencyCode)) return cache.get(currencyCode)!;
    try {
      const { rate } = await this.ratesService.getActiveRate(currencyCode, DASHBOARD_BASE_CURRENCY);
      cache.set(currencyCode, rate);
      return rate;
    } catch {
      cache.set(currencyCode, null);
      return null;
    }
  }
}
