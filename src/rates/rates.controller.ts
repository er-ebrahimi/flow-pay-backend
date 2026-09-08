import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RatesService } from './rates.service.js';
import { ExchangeRateDto, ExchangeRateQueryDto } from './dto/exchange-rate.dto.js';
import { SetExchangeRateDto } from './dto/set-exchange-rate.dto.js';
import { ValidationException } from '../error-handling/errors/domain.exceptions.js';

@ApiTags('exchange-rates')
@Controller('exchange-rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  @ApiQuery({ name: 'base', required: true })
  @ApiQuery({ name: 'quote', required: true })
  @ApiOkResponse({ type: ExchangeRateDto, description: 'Live indicative rate. Locks nothing.' })
  async getRate(@Query() query: ExchangeRateQueryDto): Promise<ExchangeRateDto> {
    // Same-currency inquiries are a user error even though both codes are
    // individually well-formed.
    if (query.base === query.quote) {
      throw new ValidationException('base and quote must differ', { reason: 'SAME_CURRENCY' });
    }
    const { rate, asOf } = await this.ratesService.getActiveRate(query.base, query.quote);
    return { base: query.base, quote: query.quote, rate, asOf };
  }

  @Post()
  @ApiOkResponse({ type: ExchangeRateDto, description: 'Rate row created; becomes active based on validFrom.' })
  async setRate(@Body() dto: SetExchangeRateDto): Promise<ExchangeRateDto> {
    if (dto.base === dto.quote) {
      throw new ValidationException('base and quote must differ', { reason: 'SAME_CURRENCY' });
    }
    const created = await this.ratesService.setRate(dto);
    return { base: created.base, quote: created.quote, rate: created.rate, asOf: created.validFrom };
  }
}
