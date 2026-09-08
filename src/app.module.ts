import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ErrorHandlingModule } from './error-handling/error-handling.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CurrenciesModule } from './currencies/currencies.module.js';
import { WalletsModule } from './wallets/wallets.module.js';
import { RatesModule } from './rates/rates.module.js';
import { ExchangeModule } from './exchange/exchange.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CurrenciesModule,
    WalletsModule,
    RatesModule,
    ExchangeModule,
    TransactionsModule,
    DashboardModule,
    ErrorHandlingModule.forRoot(),
  ],
})
export class AppModule {}
