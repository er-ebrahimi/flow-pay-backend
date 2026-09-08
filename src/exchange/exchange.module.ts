import { Module } from '@nestjs/common';

import { QuotesController } from './quotes.controller.js';
import { ExchangesController } from './exchanges.controller.js';
import { QuotesService } from './quotes.service.js';
import { ExchangeService } from './exchange.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RatesModule } from '../rates/rates.module.js';

@Module({
  imports: [PrismaModule, RatesModule],
  controllers: [QuotesController, ExchangesController],
  providers: [QuotesService, ExchangeService],
  exports: [QuotesService, ExchangeService],
})
export class ExchangeModule {}
