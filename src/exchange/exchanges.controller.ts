import { Body, Controller, Headers, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ExchangeService } from './exchange.service.js';
import { ConfirmExchangeDto } from './dto/exchange.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ValidationException } from '../error-handling/errors/domain.exceptions.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';

function requireIdempotencyKey(rawHeader: string | string[] | undefined): string {
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  // UUID shape (any version, upper or lower case).
  if (value === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) === false) {
    throw new ValidationException('Idempotency-Key header must be a uuid', { reason: 'MISSING_IDEMPOTENCY_KEY' });
  }
  return value;
}

@ApiTags('exchange')
@ApiBearerAuth('jwt')
@Controller('exchanges')
export class ExchangesController {
  constructor(private readonly exchangeService: ExchangeService) {}

  // First execution answers 201; the replayed Idempotency-Key answers 200.
  // Both carry the identical result body (see docs/API_CONTRACT.md), so the
  // client's duplicate protection rides on the key, not the status.
  @Post()
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') rawKey: string | string[] | undefined,
    @Res() response: Response,
    @Body() dto: ConfirmExchangeDto,
  ): Promise<void> {
    const idempotencyKey = requireIdempotencyKey(rawKey);
    const confirmed = await this.exchangeService.confirm(user.id, idempotencyKey, dto.quoteId);
    response
      .status(confirmed.replayed ? HttpStatus.OK : HttpStatus.CREATED)
      .json(confirmed.result);
  }
}
