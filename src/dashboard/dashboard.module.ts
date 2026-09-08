import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { WalletsModule } from '../wallets/wallets.module.js';
import { RatesModule } from '../rates/rates.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';

@Module({
  imports: [WalletsModule, RatesModule, TransactionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
