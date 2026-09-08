import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CurrencyDto, ExcludeCurrencyQueryDto } from './dto/currencies.dto.js';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: ExcludeCurrencyQueryDto): Promise<CurrencyDto[]> {
    // Single correlated read: the wallet count rides along on the currency
    // row as `wallets: number` via the include/count aggregate — no second
    // query and no client-side grouping.
    const rows = await this.prisma.db.orm.public.Currency.include(
      'wallets',
      (wallets) => wallets.count(),
    ).all();

    return rows
      .filter((row) => row.code !== query?.exclude)
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((row) => ({
        code: row.code,
        name: row.name,
        decimalPlaces: row.decimalPlaces,
        walletCount: row.wallets,
      }));
  }
}
