import { ApiProperty } from '@nestjs/swagger';

export class WalletDto {
  @ApiProperty({ example: 'USD' })
  currencyCode!: string;

  @ApiProperty({
    example: '100.00',
    description: 'Display-ready balance at the currency decimalPlaces precision.',
  })
  balance!: string;

  @ApiProperty({
    example: 0,
    description: 'Transactions where the currency is the source or the destination.',
  })
  transactionCount!: number;

  @ApiProperty({ example: '2026-09-07T18:22:24.163Z', title: 'Only returned in the detail route.' })
  createdAt?: string;
}
