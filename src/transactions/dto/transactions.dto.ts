import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ListTransactionsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1 })
  page!: number;

  /** Hard-clamped to 100 in the service — documented in API_CONTRACT.md. */
  @IsOptional()
  @IsInt()
  @Min(1)
  limit!: number;

  @IsOptional()
  @IsIn(['EXCHANGE'])
  @ApiPropertyOptional({ example: 'EXCHANGE' })
  type!: 'EXCHANGE';

  @IsOptional()
  @IsIn(['PENDING', 'COMPLETED', 'FAILED'])
  @ApiPropertyOptional({ example: 'COMPLETED' })
  status!: 'PENDING' | 'COMPLETED' | 'FAILED';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'USD', description: 'Currency of the source or destination side.' })
  currency!: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'dateFrom must be an ISO 8601 date-time' })
  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  dateFrom!: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'dateTo must be an ISO 8601 date-time' })
  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  dateTo!: string;

  /** Matches the uuid prefix only: a user cannot guess-by-name other ids. */
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'db41' })
  search!: string;
}

export class TransactionItemDto {
  @ApiProperty({ example: 'b6f7a11f-6d8c-45f2-8f5b-7ad23a3ff10f' })
  id!: string;

  @ApiProperty({ example: 'EXCHANGE' })
  type!: 'EXCHANGE';

  @ApiProperty({ example: 'USD' })
  fromCurrency!: string;

  @ApiProperty({ example: 'EUR' })
  toCurrency!: string;

  @ApiProperty({ example: '50.00' })
  sourceAmount!: string;

  @ApiProperty({ example: '42.24' })
  destinationAmount!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: 'COMPLETED' | 'PENDING' | 'FAILED';

  @ApiProperty({ example: '2026-09-08T09:29:54.213Z' })
  createdAt!: string;
}

export class TransactionDetailDto extends TransactionItemDto {
  @ApiProperty({ example: '0.38' })
  fee!: string;

  @ApiProperty({ example: '0.8512' })
  rate!: string;

  @ApiProperty({ description: 'The quote that froze the exchange; uuid.' })
  quoteId!: string | null;
}

export class TransactionIdParamDto {
  @IsUUID(undefined, { message: 'id must be a uuid' })
  id!: string;
}
