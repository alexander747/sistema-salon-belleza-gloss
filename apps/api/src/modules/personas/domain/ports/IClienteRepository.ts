import { ClienteEntity } from '../../../../infrastructure/persistence/entities/ClienteEntity';

export interface IClienteRepository {
  findBySalon(salonId: number, telefono?: string): Promise<ClienteEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ClienteEntity | null>;
  findBySalonAndTelefono(salonId: number, telefono: string): Promise<ClienteEntity | null>;
  create(data: Partial<ClienteEntity>): Promise<ClienteEntity>;
  update(id: number, data: Partial<ClienteEntity>): Promise<ClienteEntity | null>;
}
