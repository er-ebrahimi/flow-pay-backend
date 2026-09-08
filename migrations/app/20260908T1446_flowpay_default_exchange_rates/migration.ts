#!/usr/bin/env -S node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import type {
  Contract as End,
  Contract as Start,
} from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract';
import endContract from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract.json' with { type: 'json' };
import startContract from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';
import { MigrationPlanOperation } from '@prisma/orm-postgres/components';

// The rate is read when this file self-emits ops.json and is then baked into
// the committed package — editing .env afterwards does not touch rows that
// were already seeded (a change needs a follow-up data migration).
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

// numeric(18,10) leaves room for 8 integer + 10 fraction digits; anything
// outside that shape falls back to 1:1 parity rather than failing the seed.
const DEFAULT_RATE_PATTERN = /^\d{1,8}(\.\d{1,10})?$/;
const SEED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED'] as const;
// Far-past validFrom keeps the defaults active forever while still losing to
// any real rate: getActiveRate picks the newest validFrom among active rows.
const VALID_FROM = '2000-01-01T00:00:00Z';
const VALID_TO = '9999-12-31T23:59:59.999Z';

function defaultRate(): string {
  const raw = (process.env['EXCHANGE_RATE_DEFAULT'] ?? '').trim();
  return DEFAULT_RATE_PATTERN.test(raw) ? raw : '1';
}

function target(objectType: string, name: string, schema: string, table: string) {
  return {
    id: `postgres:${schema}.${table}.${objectType}.${name}`,
    details: { schema, objectType, name, table },
  };
}

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations():readonly (MigrationPlanOperation | Promise<MigrationPlanOperation>)[] {
    const rate = defaultRate();
    const pairs = SEED_CURRENCIES.flatMap((base) =>
      SEED_CURRENCIES.filter((quote) => quote !== base).map(
        (quote) => `(gen_random_uuid(), '${base}', '${quote}', '${rate}', '${VALID_FROM}', '${VALID_TO}')`,
      ),
    );

    return [
      rawSql({
        id: 'flowpay.default-exchange-rates',
        label: 'Seed default exchange rates for all seeded currency pairs',
        operationClass: 'data',
        target: target('trigger', 'flowpay-default-rates', 'public', 'exchangeRate'),
        precheck: [],
        execute: [
          {
            description: `Insert active default rate ${rate} for every ordered pair of ${SEED_CURRENCIES.join('/')}`,
            sql: `
              INSERT INTO "public"."exchangeRate" ("id", "baseCurrency", "quoteCurrency", "rate", "validFrom", "validTo")
              VALUES
                ${pairs.join(',\n                ')};
            `,
          },
        ],
        postcheck: [],
      } as never),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
