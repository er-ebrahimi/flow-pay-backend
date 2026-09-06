import 'dotenv/config';
import type { Contract } from './schema.d';
export declare const db: import("@prisma/orm-postgres/runtime").PostgresClient<Contract>;
