import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class SetExchangeRateDto {
  @Matches(/^[A-Z]{3}$/, { message: 'base must be a 3-letter currency code' })
  @ApiProperty({ example: 'USD' })
  base!: string;

  @Matches(/^[A-Z]{3}$/, { message: 'quote must be a 3-letter currency code' })
  @ApiProperty({ example: 'EUR' })
  quote!: string;

  @Matches(/^\d+(\.\d+)?$/, { message: 'rate must be a positive decimal string' })
  @ApiProperty({ example: '0.8612' })
  rate!: string;

  @IsDateString({ strict: true }, { message: 'validFrom must be an ISO 8601 date-time' })
  @ApiProperty({ example: '2026-09-08T00:00:00Z' })
  validFrom!: string;

  @IsDateString({ strict: true }, { message: 'validTo must be an ISO 8601 date-time' })
  @ApiProperty({ example: '9999-12-31T23:59:59Z' })
  validTo!: string;
}
