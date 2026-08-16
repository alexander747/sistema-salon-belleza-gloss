import type { CajaEntity, EstadoCaja } from '../../../../infrastructure/persistence/entities/CajaEntity';

export interface CerrarCajaData {
  montoEsperado: number;
  montoRealEfectivo: number;
  diferencia: number;
  cierrePorId?: number | null;
}

export interface ICajaRepository {
  /** Caja por id (cualquier estado) — para detalle de cierre. */
  findById(id: number): Promise<CajaEntity | null>;
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
  /**
   * UPDATE condicional — reabre la MISMA caja SOLO si estado === 'CERRADA'
   * (mismo id, sin crear fila nueva) y limpia los datos del cierre intermedio.
   * Devuelve true si 1 fila afectada, false si ya estaba abierta (race de reapertura).
   */
  reabrir(id: number): Promise<boolean>;
  listBySalonPaginated(
    salonId: number,
    page: number,
    limit: number,
    estado?: EstadoCaja,
  ): Promise<{ data: CajaEntity[]; total: number }>;
}
