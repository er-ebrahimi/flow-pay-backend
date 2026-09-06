import { Injectable } from '@nestjs/common';
import { db } from './db.js';

export type PrismaDb = typeof db;

@Injectable()
export class PrismaService {
  readonly db: PrismaDb = db;
}
