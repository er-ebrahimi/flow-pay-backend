import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

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
   * Passes the verified payload straight to the request context; there is no
   * database lookup because the token is the sole source of truth.
   */
  override validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
