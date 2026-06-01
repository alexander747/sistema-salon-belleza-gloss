import { Rol } from '@pos-final/types';

export interface TokenPayload {
  sub: number;
  salonId: number;
  rol: Rol;
  nombre: string;
  email: string;
}

export interface RefreshTokenResult {
  userId: number;
  tokenFamily: string;
}

export interface ITokenService {
  generateAccessToken(payload: TokenPayload): string;
  generateRefreshToken(userId: number): Promise<string>;
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): Promise<RefreshTokenResult>;
  invalidateTokenFamily(userId: number): Promise<void>;
}
