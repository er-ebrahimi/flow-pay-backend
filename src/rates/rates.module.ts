import { Module } from '@nestjs/common';

import { RatesController } from './rates.controller.js';
import { RatesService } from './rates.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [RatesController],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
