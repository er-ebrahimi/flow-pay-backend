import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RatesService } from './rates.service.js';
import { ExchangeRateDto, ExchangeRateQueryDto } from './dto/exchange-rate.dto.js';
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
}
