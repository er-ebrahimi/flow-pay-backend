import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordHasher } from './hasher/password-hasher.port.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthCommandResult, LoginResult, isUniqueViolation } from './auth.types.js';
import { ttlToSeconds } from './ttl-in-seconds.js';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';

type Numeric18x6 = Numeric<18, 6>;

function numeric18x6(value: string): Numeric18x6 {
  return value as unknown as Numeric18x6;
}

@Injectable()
export class AuthService {
  private readonly registerInitialWalletCurrencyCode = 'USD';

  readonly initialWalletBalanceUsd = numeric18x6('100.00');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthCommandResult> {
    const passwordHash = await this.hasher.hash(dto.password);
    try {
      return await this.prisma.db.transaction(async (tx) => {
        const user = await tx.orm.public.User.create({
          email: dto.email,
          passwordHash,
        });
        // Wallet and user are created atomically so every registered user
        // always has the dashboard's starter wallet.
        await tx.orm.public.Wallet.create({
          userId: user.id,
          currencyCode: this.registerInitialWalletCurrencyCode,
          balance: this.initialWalletBalanceUsd,
          version: 0,
        });
        return { id: user.id, email: user.email, createdAt: user.createdAt };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.db.orm.public.User.where({ email: dto.email }).first();
    const matches = user
      ? await this.hasher.verify(dto.password, user.passwordHash)
      : false;

    // Unknown email and wrong password are intentionally indistinguishable
    // so the endpoint cannot be used to enumerate accounts.
    if (user === null || matches === false) {
      throw new UnauthorizedException('invalid email or password');
    }

    return {
      accessToken: this.jwtService.sign({ sub: user.id, email: user.email }),
      expiresIn: ttlToSeconds(this.config.get<string>('JWT_EXPIRES_IN')) ?? 86_400,
    };
  }

  async logout(): Promise<void> {
    // Intentionally a no-op: stateless JWTs cannot be revoked server-side;
    // the client discards the token.
    return undefined;
  }
}
