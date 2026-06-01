import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { ClienteEntity } from '../../../../infrastructure/persistence/entities/ClienteEntity';
import type { IClienteRepository } from '../../domain/ports/IClienteRepository';

@injectable()
export class TypeORMClienteRepository implements IClienteRepository {
  private getRepo() {
    return AppDataSource.getRepository(ClienteEntity);
  }

  async findBySalon(salonId: number, telefono?: string): Promise<ClienteEntity[]> {
    const where: Record<string, unknown> = { salonId };
    if (telefono !== undefined) where.telefono = telefono;
    return this.getRepo().find({ where, order: { nombre: 'ASC' } });
  }

  async findBySalonAndId(salonId: number, id: number): Promise<ClienteEntity | null> {
    return this.getRepo().findOneBy({ id, salonId });
  }

  async findBySalonAndTelefono(salonId: number, telefono: string): Promise<ClienteEntity | null> {
    return this.getRepo().findOneBy({ telefono, salonId });
  }

  async create(data: Partial<ClienteEntity>): Promise<ClienteEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<ClienteEntity>): Promise<ClienteEntity | null> {
    await this.getRepo().update(id, data);
    return this.getRepo().findOneBy({ id });
  }
}
