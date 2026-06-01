import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';
import type { IUsuarioRepository } from '../../domain/ports/IUsuarioRepository';
import { Rol } from '@pos-final/types';

@injectable()
export class TypeORMUsuarioRepository implements IUsuarioRepository {
  private getRepo() {
    return AppDataSource.getRepository(UsuarioEntity);
  }

  async findBySalon(salonId: number, rol?: Rol, activo?: boolean): Promise<UsuarioEntity[]> {
    const where: Record<string, unknown> = { salonId };
    if (rol !== undefined) where.rol = rol;
    if (activo !== undefined) where.activo = activo;
    return this.getRepo().find({ where, order: { nombre: 'ASC' } });
  }

  async findBySalonAndId(salonId: number, id: number): Promise<UsuarioEntity | null> {
    return this.getRepo().findOneBy({ id, salonId });
  }

  async findBySalonAndPhone(salonId: number, phone: string): Promise<UsuarioEntity | null> {
    return this.getRepo().findOneBy({ numeroWhatsApp: phone, salonId });
  }

  async create(data: Partial<UsuarioEntity>): Promise<UsuarioEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<UsuarioEntity>): Promise<UsuarioEntity | null> {
    await this.getRepo().update(id, data);
    return this.getRepo().findOneBy({ id });
  }

  async updateActivo(id: number, activo: boolean): Promise<boolean> {
    const result = await this.getRepo().update(id, { activo });
    return result.affected !== undefined && result.affected > 0;
  }
}
