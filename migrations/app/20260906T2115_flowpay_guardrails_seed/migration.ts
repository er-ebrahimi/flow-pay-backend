#!/usr/bin/env -S node
import type {
  Contract as End,
  Contract as Start,
} from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract';
import endContract from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract.json' with { type: 'json' };
import startContract from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    const target = (objectType: string, name: string, schema: string, table: string) => ({
      id: `postgres:${schema}.${table}.${objectType}.${name}`,
      details: { schema, objectType, name, table },
    });
    const sqlOp = (
      id: string,
      label: string,
      table: string,
      execute: string,
    ) =>
      rawSql({
        id,
        label,
        operationClass: 'data',
        target: target('trigger', 'flowpay-guardrail', 'public', table),
        precheck: [],
        execute: [{ description: label, sql: execute }],
        postcheck: [],
      } as never);

    return [
      sqlOp(
        'flowpay.guardrails',
        'Add FlowPay guardrail constraints and seed default currencies',
        'currency',
        `
          ALTER TABLE "public"."exchangeQuote"
            ADD CONSTRAINT "exchangeQuote_sameCurrency_check"
            CHECK ("fromCurrency" <> "toCurrency");

          ALTER TABLE "public"."exchangeRate"
            ADD CONSTRAINT "exchangeRate_sameCurrency_check"
            CHECK ("baseCurrency" <> "quoteCurrency");

          ALTER TABLE "public"."transaction"
            ADD CONSTRAINT "transaction_sameCurrency_check"
            CHECK ("fromCurrency" <> "toCurrency");

          ALTER TABLE "public"."wallet"
            ADD CONSTRAINT "wallet_balanceNonNegative_check"
            CHECK ("balance" >= 0);

          ALTER TABLE "public"."transaction"
            ADD CONSTRAINT "transaction_sourceAmountPositive_check"
            CHECK ("sourceAmount" > 0);

          ALTER TABLE "public"."exchangeQuote"
            ADD CONSTRAINT "exchangeQuote_amountPositive_check"
            CHECK ("amount" > 0);

          INSERT INTO "public"."currency" ("code", "name", "decimalPlaces") VALUES
            ('USD', 'US Dollar',      2),
            ('EUR', 'Euro',           2),
            ('GBP', 'British Pound',  2),
            ('AED', 'UAE Dirham',     2)
          ON CONFLICT ("code") DO NOTHING;
        `,
      ),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
