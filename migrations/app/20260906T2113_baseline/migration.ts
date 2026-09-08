#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract';
import endContract from '../../snapshots/957e80e05e70d3ebd716d63b832d9fa6fb065765a6daee599f0abe2049e9361f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'currency',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('decimalPlaces', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['code'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'exchangeQuote',
        columns: [
          col('amount', 'numeric(18,6)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 6 } },
          }),
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('fee', 'numeric(18,6)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 6 } },
          }),
          col('fromCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lockedRate', 'numeric(18,10)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 10 } },
          }),
          col('toCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'exchangeRate',
        columns: [
          col('baseCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quoteCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rate', 'numeric(18,10)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 10 } },
          }),
          col('validFrom', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('validTo', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'transaction',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('destinationAmount', 'numeric(18,6)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 6 } },
          }),
          col('exchangeRate', 'numeric(18,10)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 10 } },
          }),
          col('fee', 'numeric(18,6)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 6 } },
          }),
          col('fromCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quoteId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('sourceAmount', 'numeric(18,6)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 6 } },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('toCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'transaction_status_check_04ef721f',
            "\"status\" IN ('PENDING', 'COMPLETED', 'FAILED')",
          ),
          checkExpression('transaction_type_check_71a5d00a', '"type" IN (\'EXCHANGE\')'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'wallet',
        columns: [
          col('balance', 'numeric(18,6)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 18, scale: 6 } },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currencyCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_quoteId_key',
        columns: ['quoteId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'wallet',
        constraint: 'wallet_userId_currencyCode_key',
        columns: ['userId', 'currencyCode'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exchangeQuote',
        index: 'exchangeQuote_fromCurrency_idx_1492403c',
        columns: ['fromCurrency'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exchangeQuote',
        index: 'exchangeQuote_toCurrency_idx_c6b9c205',
        columns: ['toCurrency'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exchangeQuote',
        index: 'exchangeQuote_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exchangeRate',
        index: 'exchangeRate_baseCurrency_idx_83e93f63',
        columns: ['baseCurrency'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exchangeRate',
        index: 'exchangeRate_baseCurrency_quoteCurrency_idx_5f73ab3f',
        columns: ['baseCurrency', 'quoteCurrency'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exchangeRate',
        index: 'exchangeRate_quoteCurrency_idx_924ca661',
        columns: ['quoteCurrency'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_fromCurrency_idx_1492403c',
        columns: ['fromCurrency'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_quoteId_idx_a7628ce5',
        columns: ['quoteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_toCurrency_idx_c6b9c205',
        columns: ['toCurrency'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_userId_type_idx_59b0b5ce',
        columns: ['userId', 'type'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'wallet',
        index: 'wallet_currencyCode_idx_bb2a6aca',
        columns: ['currencyCode'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'wallet',
        index: 'wallet_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exchangeQuote',
        foreignKey: {
          name: 'exchangeQuote_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exchangeQuote',
        foreignKey: {
          name: 'exchangeQuote_fromCurrency_fkey',
          columns: ['fromCurrency'],
          references: { schema: 'public', table: 'currency', columns: ['code'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exchangeQuote',
        foreignKey: {
          name: 'exchangeQuote_toCurrency_fkey',
          columns: ['toCurrency'],
          references: { schema: 'public', table: 'currency', columns: ['code'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exchangeRate',
        foreignKey: {
          name: 'exchangeRate_baseCurrency_fkey',
          columns: ['baseCurrency'],
          references: { schema: 'public', table: 'currency', columns: ['code'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exchangeRate',
        foreignKey: {
          name: 'exchangeRate_quoteCurrency_fkey',
          columns: ['quoteCurrency'],
          references: { schema: 'public', table: 'currency', columns: ['code'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_quoteId_fkey',
          columns: ['quoteId'],
          references: { schema: 'public', table: 'exchangeQuote', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_fromCurrency_fkey',
          columns: ['fromCurrency'],
          references: { schema: 'public', table: 'currency', columns: ['code'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_toCurrency_fkey',
          columns: ['toCurrency'],
          references: { schema: 'public', table: 'currency', columns: ['code'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'wallet',
        foreignKey: {
          name: 'wallet_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'wallet',
        foreignKey: {
          name: 'wallet_currencyCode_fkey',
          columns: ['currencyCode'],
          references: { schema: 'public', table: 'currency', columns: ['code'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
