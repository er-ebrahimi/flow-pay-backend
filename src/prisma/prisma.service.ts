import { Injectable } from '@nestjs/common';
import { db } from './db.js';

export type PrismaDb = typeof db;
// Transaction callback context (sql + orm handles); the execut­ion-scoped
// client is the closest narrow type the runtime exports publicly.
export type PrismaTransaction = Parameters<Parameters<PrismaDb['transaction']>[0]>[0];

@Injectable()
export class PrismaService {
  readonly db: PrismaDb = db;
}
