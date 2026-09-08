import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CurrencyCodeParamDto } from './dto/currency-code.param.js';
import { WalletDto } from './dto/wallet.dto.js';
import { WalletsService } from './wallets.service.js';

@ApiBearerAuth('jwt')
@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOkResponse({ type: [WalletDto], description: "The caller's wallets, sorted by currency code." })
  async getWallets(@CurrentUser() user: AuthenticatedUser): Promise<WalletDto[]> {
    return this.walletsService.findAllForUser(user.id);
  }

  @Get(':currencyCode')
  @ApiOkResponse({ type: WalletDto })
  async getWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CurrencyCodeParamDto,
  ): Promise<WalletDto> {
    return this.walletsService.findByCode(user.id, params.currencyCode);
  }
}
