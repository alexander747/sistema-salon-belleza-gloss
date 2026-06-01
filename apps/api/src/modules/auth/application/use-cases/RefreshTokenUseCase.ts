import { injectable, inject } from 'tsyringe';
import { UnauthorizedError } from '../../../../shared/errors';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../domain/ports/IUsuarioRepository';
import type { ITokenService } from '../../domain/ports/ITokenService';
import type { ISalonRepository } from '../../../salon/domain/ports/ISalonRepository';

interface RefreshOutput {
  accessToken: string;
  refreshToken: string;
}

@injectable()
export class RefreshTokenUseCase {
  constructor(
    @inject('IUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
    @inject('ITokenService') private readonly tokenService: ITokenService,
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(refreshToken: string): Promise<RefreshOutput> {
    try {
      const { userId } = await this.tokenService.verifyRefreshToken(refreshToken);

      const user = await this.usuarioRepo.findById(userId);
      if (!user || !user.activo) {
        throw new UnauthorizedError('Token inválido', { code: 'TOKEN_INVALID' });
      }

      // Superadmin: auto-assign first salon if none assigned
      let salonId = user.salonId ?? 0;
      if (user.rol === Rol.SUPERADMIN && (user.salonId == null || user.salonId === 0)) {
        const salones = await this.salonRepo.findAll();
        if (salones.length > 0) {
          salonId = salones[0].id;
        }
      }

      // Generate new token pair
      const newAccessToken = this.tokenService.generateAccessToken({
        sub: user.id,
        salonId,
        rol: user.rol,
        nombre: user.nombre,
        email: user.email,
      });

      const newRefreshToken = await this.tokenService.generateRefreshToken(user.id);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      const message = (error as Error).message;
      if (message === 'TOKEN_REUSE_DETECTED') {
        throw new UnauthorizedError('Token reutilizado detectado — familia revocada', {
          code: 'TOKEN_REUSE_DETECTED',
        });
      }
      if (message === 'TOKEN_INVALID' || message === 'TOKEN_EXPIRED') {
        throw new UnauthorizedError('Token inválido o expirado', { code: message });
      }

      // jwt errors (expired, malformed)
      if (error && typeof error === 'object' && 'name' in error) {
        const jwtErr = error as { name: string; message: string };
        if (jwtErr.name === 'TokenExpiredError') {
          throw new UnauthorizedError('Token de refresco expirado', { code: 'TOKEN_EXPIRED' });
        }
        if (jwtErr.name === 'JsonWebTokenError') {
          throw new UnauthorizedError('Token de refresco inválido', { code: 'TOKEN_INVALID' });
        }
      }

      throw new UnauthorizedError('Token inválido', { code: 'TOKEN_INVALID' });
    }
  }
}
