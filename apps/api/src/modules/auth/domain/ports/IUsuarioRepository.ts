import { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';

export interface IUsuarioRepository {
  findById(id: number): Promise<UsuarioEntity | null>;
  findByEmail(email: string): Promise<UsuarioEntity | null>;
  findByPhone(phone: string): Promise<UsuarioEntity | null>;
  create(data: Partial<UsuarioEntity>): Promise<UsuarioEntity>;
  update(id: number, data: Partial<UsuarioEntity>): Promise<UsuarioEntity | null>;
}
