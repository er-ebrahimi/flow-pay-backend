import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '../error-handling/errors/domain.exceptions.js';
import { renderRate } from './rate-string.mapper.js';

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The indicative (unlocked) rate displayed while the user types.
   * An "active" row covers `now` inside [validFrom, validTo); when several
   * overlap, the newest validFrom wins. No rate row is dated forever-empty:
   * the pair simply has no active rate and the caller sees NOT_FOUND.
   */
  async getActiveRate(base: string, quote: string): Promise<{ rate: string; asOf: string }> {
    const rows = (await this.prisma.db.orm.public.ExchangeRate.where({
      baseCurrency: base,
      quoteCurrency: quote,
    }).all()) as Array<{ rate: string; validFrom: string; validTo: string }>;

    const now = Date.now();
    const active = rows
      .filter((row) => Date.parse(row.validFrom) <= now && now < Date.parse(row.validTo))
      .sort((left, right) => Date.parse(right.validFrom) - Date.parse(left.validFrom))[0];

    if (active === undefined) {
      throw new NotFoundException('no active rate for this currency pair', { base, quote });
    }
    return { rate: renderRate(active.rate), asOf: new Date(active.validFrom).toISOString() };
  }
}
