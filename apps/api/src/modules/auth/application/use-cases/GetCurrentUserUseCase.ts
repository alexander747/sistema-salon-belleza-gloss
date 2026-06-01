import { injectable, inject } from 'tsyringe';
import { NotFoundError } from '../../../../shared/errors';
import type { IUsuarioRepository } from '../../domain/ports/IUsuarioRepository';
import type { UserProfile } from '../dto/AuthOutput';

export interface CurrentUserOutput extends UserProfile {
  salon?: {
    id: number;
    nombre: string;
    logoUrl: string | null;
    colorPrimario: string | null;
    colorSecundario: string | null;
    tema: string | null;
  } | null;
}

@injectable()
export class GetCurrentUserUseCase {
  constructor(
    @inject('IUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(userId: number): Promise<CurrentUserOutput> {
    const user = await this.usuarioRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    let salonData: CurrentUserOutput['salon'] = null;
    if (user.salon) {
      salonData = {
        id: user.salon.id,
        nombre: user.salon.nombre,
        logoUrl: user.salon.logoUrl ?? null,
        colorPrimario: user.salon.colorPrimario ?? null,
        colorSecundario: user.salon.colorSecundario ?? null,
        tema: user.salon.tema ?? null,
      };
    }

    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      salonId: user.salonId ?? 0,
      activo: user.activo,
      salon: salonData,
    };
  }
}
