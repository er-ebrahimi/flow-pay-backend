import { ApiProperty } from '@nestjs/swagger';

export class DashboardDto {
  @ApiProperty({
    example: '184.48',
    description: "Sum of every wallet converted to the base currency ('USD' fixed); wallets without an active USD rate are excluded from the total.",
  })
  totalBalanceBase!: string;

  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({
    example: [{ currencyCode: 'USD', balance: '100.00' }],
    description: "The user's wallets with base-converted balances as strings.",
  })
  wallets!: Array<{ currencyCode: string; balance: string; balanceBase?: string }>;

  @ApiProperty({ description: "The user's last 5 transactions, same shape as the first page of GET /transactions." })
  recentTransactions!: Array<Record<string, unknown>>;
}
