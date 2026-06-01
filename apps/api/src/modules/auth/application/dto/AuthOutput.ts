import type { Rol } from '@pos-final/types';

export interface UserProfile {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  salonId: number;
  activo: boolean;
}

export interface AuthOutput {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}
