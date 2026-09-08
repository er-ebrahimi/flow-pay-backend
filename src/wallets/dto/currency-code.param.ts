import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** Route parameter: the wallet's currency code. */
export class CurrencyCodeParamDto {
  @Matches(/^[A-Z]{3}$/, { message: 'currencyCode must be a 3-letter currency code' })
  @ApiProperty({ example: 'USD' })
  currencyCode!: string;
}
