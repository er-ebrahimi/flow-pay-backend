import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { TransactionsService } from './transactions.service.js';
import {
  ListTransactionsQueryDto,
  TransactionDetailDto,
  TransactionIdParamDto,
  TransactionItemDto,
} from './dto/transactions.dto.js';

@ApiTags('transactions')
@ApiBearerAuth('jwt')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paged, newest first; `items: []` is an empty state, not an error.' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<{ items: TransactionItemDto[]; page: number; limit: number; total: number }> {
    return this.transactionsService.list(user.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: TransactionDetailDto })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: TransactionIdParamDto,
  ): Promise<TransactionDetailDto> {
    return this.transactionsService.findOne(user.id, params.id);
  }
}
