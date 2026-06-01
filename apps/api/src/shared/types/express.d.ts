import { Rol } from '@pos-final/types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        rol: Rol;
        salonId: number;
        nombre: string;
      };
      salonId?: number;
      validated?: unknown;
    }
  }
}
