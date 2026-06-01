import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { injectable } from 'tsyringe';
import type { SignOptions } from 'jsonwebtoken';
import { AppDataSource } from '../../../../shared/database';
import { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';
import type { TokenPayload, RefreshTokenResult, ITokenService } from '../../domain/ports/ITokenService';

function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

@injectable()
export class JwtTokenService implements ITokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpires: number;
  private readonly refreshExpires: number;

  constructor() {
    this.accessSecret = getEnv('JWT_ACCESS_SECRET', 'access-secret-dev-only');
    this.refreshSecret = getEnv('JWT_REFRESH_SECRET', 'refresh-secret-dev-only');
    this.accessExpires = parseDuration(getEnv('JWT_ACCESS_EXPIRES', '15m'));
    this.refreshExpires = parseDuration(getEnv('JWT_REFRESH_EXPIRES', '7d'));
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      {
        sub: payload.sub,
        salonId: payload.salonId,
        rol: payload.rol,
        nombre: payload.nombre,
        email: payload.email,
      },
      this.accessSecret,
      { expiresIn: this.accessExpires } as SignOptions,
    );
  }

  async generateRefreshToken(userId: number): Promise<string> {
    const family = crypto.randomUUID();
    const userRepo = AppDataSource.getRepository(UsuarioEntity);

    // Create JWT refresh token containing userId + family
    const token = jwt.sign({ sub: userId, family }, this.refreshSecret, {
      expiresIn: this.refreshExpires,
    } as SignOptions);

    // Store bcrypt hash of token + family UUID for reuse detection
    const hashedToken = await bcrypt.hash(token, 10);
    await userRepo.update(userId, {
      refreshToken: hashedToken,
      refreshTokenFamily: family,
    });

    return token;
  }

  verifyAccessToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.accessSecret) as jwt.JwtPayload & {
      sub: number;
      salonId: number;
      rol: number;
      nombre: string;
      email: string;
    };
    return {
      sub: decoded.sub,
      salonId: decoded.salonId,
      rol: decoded.rol,
      nombre: decoded.nombre,
      email: decoded.email,
    };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenResult> {
    const decoded = jwt.verify(token, this.refreshSecret) as jwt.JwtPayload & {
      sub: number;
      family: string;
    };

    const userRepo = AppDataSource.getRepository(UsuarioEntity);
    const user = await userRepo.findOneBy({ id: decoded.sub });

    if (!user || !user.refreshTokenFamily || !user.refreshToken) {
      throw new Error('TOKEN_INVALID');
    }

    // Check if the token family matches
    if (user.refreshTokenFamily !== decoded.family) {
      // Reuse detected — invalidate the entire family
      await userRepo.update(user.id, {
        refreshToken: null,
        refreshTokenFamily: null,
      });
      throw new Error('TOKEN_REUSE_DETECTED');
    }

    // Verify the bcrypt hash matches
    const isValid = await bcrypt.compare(token, user.refreshToken);
    if (!isValid) {
      throw new Error('TOKEN_INVALID');
    }

    return { userId: user.id, tokenFamily: user.refreshTokenFamily };
  }

  async invalidateTokenFamily(userId: number): Promise<void> {
    const userRepo = AppDataSource.getRepository(UsuarioEntity);
    await userRepo.update(userId, {
      refreshToken: null,
      refreshTokenFamily: null,
    });
  }
}

/** Parse a duration string (e.g. '15m', '7d', '1h') into seconds for jsonwebtoken. */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 900; // default 15m in seconds
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 900;
  }
}
