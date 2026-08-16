import type { CajaEntity, EstadoCaja } from '../../../../infrastructure/persistence/entities/CajaEntity';

export interface CerrarCajaData {
  montoEsperado: number;
  montoRealEfectivo: number;
  diferencia: number;
  cierrePorId?: number | null;
}

export interface ICajaRepository {
  /** Cualquier estado (ABIERTA o CERRADA) para salon+fecha. */
  findBySalonYFecha(salonId: number, fechaCaja: string): Promise<CajaEntity | null>;
  /** Solo caja ABIERTA para salon+fecha. */
  findAbiertaBySalonYFecha(salonId: number, fechaCaja: string): Promise<CajaEntity | null>;
  create(data: Partial<CajaEntity>): Promise<CajaEntity>;
  /**
   * UPDATE condicional — cierra SOLO si estado === 'ABIERTA'.
   * Devuelve true si 1 fila afectada (el cierre ganó la race), false si ya estaba cerrada.
   */
  cerrar(id: number, data: CerrarCajaData): Promise<boolean>;
  listBySalonPaginated(
    salonId: number,
    page: number,
    limit: number,
    estado?: EstadoCaja,
  ): Promise<{ data: CajaEntity[]; total: number }>;
}
