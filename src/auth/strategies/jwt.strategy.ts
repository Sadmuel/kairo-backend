import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Represents the authenticated user from JWT.
 * This is attached to request.user by Passport.
 */
export interface AuthUser {
  id: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validates the JWT payload and returns the authenticated user.
   *
   * We trust the JWT payload without a database lookup because:
   * 1. Access tokens are short-lived (15 minutes)
   * 2. The JWT signature is cryptographically verified by Passport
   * 3. Eliminates N+1 query problem (no DB call per request)
   *
   * If you need to check user status (e.g., banned), consider:
   * - Adding a tokenVersion to JWT and checking against DB periodically
   * - Using a cache layer for user status lookups
   */
  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
