import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class ExchangeRateQueryDto {
  @Matches(/^[A-Z]{3}$/, { message: 'base must be a 3-letter currency code' })
  @ApiProperty({ example: 'USD' })
  base!: string;

  @Matches(/^[A-Z]{3}$/, { message: 'quote must be a 3-letter currency code' })
  @ApiProperty({ example: 'EUR' })
  quote!: string;
}

export class ExchangeRateDto {
  @ApiProperty({ example: 'USD' })
  base!: string;

  @ApiProperty({ example: 'EUR' })
  quote!: string;

  @ApiProperty({ example: '0.8512', description: 'Exact rate, as stored.' })
  rate!: string;

  @ApiProperty({
    example: '2026-09-07T18:22:24.163Z',
    description: 'validFrom of the active rate row that answered the request.',
    title: 'asOf',
  })
  asOf!: string;
}
