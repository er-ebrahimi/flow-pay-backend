import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrenciesService } from './currencies.service.js';
import { CurrencyDto, ExcludeCurrencyQueryDto } from './dto/currencies.dto.js';

@ApiTags('currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiQuery({ name: 'exclude', required: false })
  @ApiOkResponse({ type: [CurrencyDto], description: 'Currencies sorted by code.' })
  async findAll(@Query() query: ExcludeCurrencyQueryDto): Promise<CurrencyDto[]> {
    return this.currenciesService.findAll(query);
  }
}
