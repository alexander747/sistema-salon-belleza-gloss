import { Rol } from './user.js';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    nombre: string;
    email: string;
    rol: Rol;
    salonId: number;
  };
}

export interface TokenPayload {
  sub: number;
  salonId: number;
  rol: Rol;
}

export interface JwtPayload extends TokenPayload {
  iat?: number;
  exp?: number;
}
