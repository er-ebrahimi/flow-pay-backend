import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class ExcludeCurrencyQueryDto {
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'exclude must be a 3-letter currency code' })
  @ApiProperty({
    required: false,
    example: 'USD',
    description: 'Return rows without this currency. A well-formed but unknown code silently filters nothing.',
  })
  exclude!: string;
}

export class CurrencyDto {
  // Response-only shape — class-validator never runs here; the constraint is
  // documented so Swagger publishes the format clients will actually receive.
  @ApiProperty({ example: 'USD', pattern: '^[A-Z]{3}$' })
  code!: string;

  @ApiProperty({ example: 'US Dollar' })
  name!: string;

  @ApiProperty({ example: 2 })
  decimalPlaces!: number;

  @ApiProperty({ example: 4, description: 'Number of wallets holding this currency (global statistic).' })
  walletCount!: number;
}
