import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import type { PrismaDb } from '../prisma/prisma.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { PasswordHasher } from './hasher/password-hasher.port.js';

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const USER: UserRow = {
  id: crypto.randomUUID(),
  email: 'user@example.com',
  passwordHash: 'hashed',
  createdAt: new Date(),
};

/** Builds a fake PrismaDb with an inline, inspectable transaction mock. */
function mockDb(
  transactionImpl: 'ok' | 'uniqueViolation',
  walletCreates: unknown[],
): PrismaDb {
  const createWallet = (data: unknown) => {
    walletCreates.push(data);
    return Promise.resolve({ id: 'wallet-1', ...data });
  };
  const createUser = (data: { email: string; passwordHash: string }) =>
    Promise.resolve({ ...USER, email: data.email, passwordHash: data.passwordHash });

  return {
    orm: {
      public: {
        User: {
          where: () => ({ first: () => Promise.resolve(USER) }),
          create: transactionImpl === 'ok' ? createUser : undefined,
        },
        Wallet: transactionImpl === 'ok' ? { create: createWallet } : undefined,
      },
    },
    transaction: async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      if (transactionImpl === 'uniqueViolation') {
        throw Object.assign(new Error('duplicate key'), { sqlState: '23505' });
      }
      await fn({
        orm: {
          public: {
            User: { create: createUser },
            Wallet: { create: createWallet },
          },
        },
      });
      return undefined;
    },
  } as unknown as PrismaDb;
}

function recordedDb(walletCreates: unknown[]): PrismaDb {
  const createWallet = (data: unknown) => {
    walletCreates.push(data);
    return Promise.resolve({ id: 'wallet-1', ...data });
  };
  const createUser = (data: { email: string; passwordHash: string }) =>
    Promise.resolve({ ...USER, email: data.email, passwordHash: data.passwordHash });

  return {
    orm: {
      public: {
        User: {
          where: () => ({ first: () => Promise.resolve(USER) }),
          create: createUser,
        },
        Wallet: { create: createWallet },
      },
    },
    transaction: async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      await fn({
        orm: {
          public: {
            User: { create: createUser },
            Wallet: { create: createWallet },
          },
        },
      });
      return USER;
    },
  } as unknown as PrismaDb;
}

function loginDb(user: UserRow | null): PrismaDb {
  return {
    orm: {
      public: {
        User: { where: () => ({ first: () => Promise.resolve(user) }) },
      },
    },
  } as unknown as PrismaDb;
}

async function serviceFor(db: PrismaDb): Promise<AuthService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: { db } },
      {
        provide: PasswordHasher,
        useValue: {
          hash: vi.fn().mockResolvedValue('hashed'),
          verify: vi.fn().mockResolvedValue(true),
        },
      },
      { provide: JwtService, useValue: { sign: vi.fn().mockReturnValue('token-123') } },
      { provide: ConfigService, useValue: { get: () => '1d' } },
    ],
  }).compile();
  return moduleRef.get(AuthService);
}

function dto(email: string, password: string): RegisterDto {
  return Object.assign(new RegisterDto(), { email, password });
}

function loginDto(email: string, password: string): LoginDto {
  return Object.assign(new LoginDto(), { email, password });
}

describe('AuthService', () => {
  describe('register', () => {
    it('creates the user and the USD starter wallet inside one transaction', async () => {
      const walletCreates: unknown[] = [];
      const authService = await serviceFor(recordedDb(walletCreates));

      const result = await authService.register(dto('user@example.com', 'hunter2hunter2'));

      expect(result.email).toBe('user@example.com');
      expect(walletCreates).toEqual([
        expect.objectContaining({ currencyCode: 'USD', version: 0 }),
      ]);
    });

    it('maps a unique-violation from the transaction to ConflictException', async () => {
      const authService = await serviceFor(mockDb('uniqueViolation', []));

      await expect(
        authService.register(dto('user@example.com', 'hunter2hunter2')),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns an access token and a 1-day TTL for valid credentials', async () => {
      const authService = await serviceFor(loginDb(USER));

      const result = await authService.login(loginDto('user@example.com', 'hunter2hunter2'));

      expect(result).toEqual({ accessToken: 'token-123', expiresIn: 86_400 });
    });

    it('rejects an unknown account with UnauthorizedException', async () => {
      const authService = await serviceFor(loginDb(null));

      await expect(
        authService.login(loginDto('ghost@example.com', 'hunter2hunter2')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password with the same error as an unknown account', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: { db: loginDb(USER) } },
          {
            provide: PasswordHasher,
            useValue: { verify: vi.fn().mockResolvedValue(false), hash: vi.fn() },
          },
          { provide: JwtService, useValue: { sign: vi.fn() } },
          { provide: ConfigService, useValue: { get: () => '1d' } },
        ],
      }).compile();
      const authService = moduleRef.get(AuthService);

      await expect(
        authService.login(loginDto('user@example.com', 'wrong-password')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
