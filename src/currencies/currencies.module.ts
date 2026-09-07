import { Module } from '@nestjs/common';

import { CurrenciesController } from './currencies.controller.js';
import { CurrenciesService } from './currencies.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CurrenciesController],
  providers: [CurrenciesService],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}
