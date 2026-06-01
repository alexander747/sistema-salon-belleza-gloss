import { container } from 'tsyringe';
import { TypeORMUsuarioRepository } from '../repositories/TypeORMUsuarioRepository';
import { BcryptService } from '../services/BcryptService';
import { JwtTokenService } from '../services/JwtTokenService';

export function registerAuthDependencies(): void {
  container.register('IUsuarioRepository', { useClass: TypeORMUsuarioRepository });
  container.register('IBcryptService', { useClass: BcryptService });
  container.register('ITokenService', { useClass: JwtTokenService });
}
