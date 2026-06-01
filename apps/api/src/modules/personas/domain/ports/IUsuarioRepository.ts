import { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';
import { Rol } from '@pos-final/types';

export interface IUsuarioRepository {
  findBySalon(salonId: number, rol?: Rol, activo?: boolean): Promise<UsuarioEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<UsuarioEntity | null>;
  findBySalonAndPhone(salonId: number, phone: string): Promise<UsuarioEntity | null>;
  create(data: Partial<UsuarioEntity>): Promise<UsuarioEntity>;
  update(id: number, data: Partial<UsuarioEntity>): Promise<UsuarioEntity | null>;
  updateActivo(id: number, activo: boolean): Promise<boolean>;
}
