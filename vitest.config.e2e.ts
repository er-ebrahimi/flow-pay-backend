import { config } from 'dotenv';

// E2E runs against the dedicated flowpay_test database, never the dev one.
// override:true beats the dotenv call inside src/prisma/db.ts, which would
// otherwise fill DATABASE_URL from .env first.
config({ path: '.env', quiet: true });
config({ path: '.env.test', override: true });

if (!process.env['DATABASE_URL']?.includes('flowpay_test')) {
  throw new Error(
    'E2E safety check failed: DATABASE_URL must point at the flowpay_test database ' +
      '(load your env through vitest.config.e2e.ts, with missing .env.test values ' +
      'falling back to .env).',
  );
}

import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
