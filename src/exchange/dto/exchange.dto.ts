import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

export class CreateQuoteDto {
  @Matches(/^[A-Z]{3}$/, { message: 'fromCurrency must be a 3-letter currency code' })
  @ApiProperty({ example: 'USD' })
  fromCurrency!: string;

  @Matches(/^[A-Z]{3}$/, { message: 'toCurrency must be a 3-letter currency code' })
  @ApiProperty({ example: 'EUR' })
  toCurrency!: string;

  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  @ApiProperty({ example: '1000.00' })
  amount!: string;
}

export class ConfirmExchangeDto {
  @IsUUID()
  @ApiProperty({ example: 'db4180cc-4ff2-4be9-bbe8-2e6ee34fbedc' })
  quoteId!: string;
}

export class ExchangeQuoteResponseDto {
  @ApiProperty({ example: 'db4180cc-4ff2-4be9-bbe8-2e6ee34fbedc', description: 'uuid of the created quote.' })
  quoteId!: string;

  @ApiProperty({ example: 'USD' })
  fromCurrency!: string;

  @ApiProperty({ example: 'EUR' })
  toCurrency!: string;

  @ApiProperty({ example: '1000.00' })
  amount!: string;

  @ApiProperty({ example: '7.50', description: 'Charged in fromCurrency (default 0.75% of amount).' })
  fee!: string;

  @ApiProperty({ example: '0.8512' })
  rate!: string;

  @ApiProperty({ example: '844.84' })
  destinationAmount!: string;

  @ApiProperty({ example: '2026-09-08T19:02:00.000Z' })
  expiresAt!: string;
}

export class TransactionResultDto {
  @ApiProperty({ example: 'db4180cc-4ff2-4be9-bbe8-2e6ee34fbedc' })
  transactionId!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ example: 'USD' })
  fromCurrency!: string;

  @ApiProperty({ example: 'EUR' })
  toCurrency!: string;

  @ApiProperty({ example: '1000.00' })
  sourceAmount!: string;

  @ApiProperty({ example: '7.50' })
  fee!: string;

  @ApiProperty({ example: '0.8512' })
  rate!: string;

  @ApiProperty({ example: '845.94' })
  destinationAmount!: string;

  @ApiProperty({ example: '2026-09-08T19:02:00.000Z' })
  createdAt!: string;
}
