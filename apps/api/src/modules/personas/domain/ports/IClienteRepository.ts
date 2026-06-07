import { ClienteEntity } from '../../../../infrastructure/persistence/entities/ClienteEntity';

export interface FindBySalonPaginatedOptions {
  skip?: number;
  take?: number;
  q?: string;
}

export interface IClienteRepository {
  findBySalon(salonId: number, telefono?: string): Promise<ClienteEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ClienteEntity | null>;
  findBySalonAndTelefono(salonId: number, telefono: string): Promise<ClienteEntity | null>;
  findBySalonAndCedula(salonId: number, cedula: string): Promise<ClienteEntity | null>;
  findBySalonPaginated(salonId: number, options: FindBySalonPaginatedOptions): Promise<ClienteEntity[]>;
  countBySalon(salonId: number, q?: string): Promise<number>;
  create(data: Partial<ClienteEntity>): Promise<ClienteEntity>;
  update(id: number, data: Partial<ClienteEntity>): Promise<ClienteEntity | null>;
}
