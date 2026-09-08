import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../decorators/current-user.decorator.js';

export const JWT_STRATEGY_NAME = 'jwt';

export interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * Stateless bearer-token validation. The strategy only verifies signature and
 * expiry; it does not touch the database, because token revocation was
 * intentionally not designed in (logout is client-side token discard).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY_NAME) {
  constructor(@Inject(ConfigService) config: ConfigService) {
    // Same config door as the signing side (JwtModule): getOrThrow fails boot
    // with a clear error when JWT_SECRET is missing, so the signing secret and
    // the verification secret can never silently diverge.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Normalizes the JWT claims into the AuthenticatedUser shape the app's
   * controllers expect ({ id, email }) — `sub` is the raw claim name, not a
   * domain name, and must not leak into transport code.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}
