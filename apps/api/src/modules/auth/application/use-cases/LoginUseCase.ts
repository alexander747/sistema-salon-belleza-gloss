import { injectable, inject } from 'tsyringe';
import { UnauthorizedError } from '../../../../shared/errors';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../domain/ports/IUsuarioRepository';
import type { ITokenService } from '../../domain/ports/ITokenService';
import type { IBcryptService } from '../../infrastructure/services/BcryptService';
import type { ISalonRepository } from '../../../salon/domain/ports/ISalonRepository';
import type { LoginInput } from '../dto/LoginInput';
import type { AuthOutput } from '../dto/AuthOutput';

@injectable()
export class LoginUseCase {
  constructor(
    @inject('IUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
    @inject('ITokenService') private readonly tokenService: ITokenService,
    @inject('IBcryptService') private readonly bcryptService: IBcryptService,
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(input: LoginInput): Promise<AuthOutput> {
    const { email, password } = input;

    const user = await this.usuarioRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Credenciales inválidas', { code: 'INVALID_CREDENTIALS' });
    }

    if (!user.activo) {
      throw new UnauthorizedError('Usuario inactivo', { code: 'USER_INACTIVE' });
    }

    if (!user.passwordHash) {
      throw new UnauthorizedError('Credenciales inválidas', { code: 'INVALID_CREDENTIALS' });
    }

    const isPasswordValid = await this.bcryptService.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Credenciales inválidas', { code: 'INVALID_CREDENTIALS' });
    }

    // Superadmin: auto-assign first salon if none assigned
    let salonId = user.salonId ?? 0;
    if (user.rol === Rol.SUPERADMIN && (user.salonId == null || user.salonId === 0)) {
      const salones = await this.salonRepo.findAll();
      if (salones.length > 0) {
        salonId = salones[0].id;
      }
    }

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      salonId,
      rol: user.rol,
      nombre: user.nombre,
      email: user.email,
    });

    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        salonId,
        activo: user.activo,
      },
    };
  }
}
