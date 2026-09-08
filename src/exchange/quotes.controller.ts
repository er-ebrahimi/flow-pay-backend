import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';

import { QuotesService } from './quotes.service.js';
import { CreateQuoteDto, ExchangeQuoteResponseDto } from './dto/exchange.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('exchange')
@Controller('exchange-quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @ApiCreatedResponse({ type: ExchangeQuoteResponseDto })
  async createQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuoteDto,
  ): Promise<ExchangeQuoteResponseDto> {
    return this.quotesService.createQuote(user.id, dto);
  }
}
