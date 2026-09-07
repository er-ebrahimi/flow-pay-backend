import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ErrorHandlingModule } from './error-handling/error-handling.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CurrenciesModule } from './currencies/currencies.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CurrenciesModule,
    ErrorHandlingModule.forRoot(),
  ],
})
export class AppModule {}
