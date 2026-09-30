import type { QueryRunner } from 'typeorm';
import type { RegistroServicioEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';

/** Filtro de estado para el listado paginado de registros.
 *  - ACTIVOS: excluye ANULADO
 *  - ANULADOS: solo ANULADO
 *  - TODOS: sin filtro (default; preserva la semántica previa del API) */
export type EstadoRegistroFilter = 'ACTIVOS' | 'ANULADOS' | 'TODOS';

/** Filtro de tipo para el listado paginado de registros.
 *  - SERVICIOS: totalServicios > 0
 *  - PRODUCTOS: totalProductos > 0
 *  - TODOS: sin filtro (default) */
export type TipoRegistroFilter = 'TODOS' | 'SERVICIOS' | 'PRODUCTOS';

export interface IRegistroServicioRepository {
  create(data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity>;
  findById(id: number): Promise<RegistroServicioEntity | null>;
  findBySalon(salonId: number): Promise<RegistroServicioEntity[]>;
  /** Registros con deuda pendiente (montoPendiente > 0, no ANULADO) con cliente cargado. */
  findConDeudaBySalon(salonId: number): Promise<RegistroServicioEntity[]>;
  findBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<RegistroServicioEntity[]>;
  /** Página de registros. `search` y `count` MUST compartir los mismos criterios
   *  (`estado`/`tipo` incluidos) para que `meta.total` coincida con las filas. */
  search(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    cajaId?: number;
    estado?: EstadoRegistroFilter;
    tipo?: TipoRegistroFilter;
    skip?: number;
    take?: number;
  }): Promise<RegistroServicioEntity[]>;
  /** Total de registros que cumplen los MISMOS filtros que `search`. */
  count(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    cajaId?: number;
    estado?: EstadoRegistroFilter;
    tipo?: TipoRegistroFilter;
  }): Promise<number>;
  update(id: number, data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity | null>;
  /** Σ pagos recibidos en el período por fecha de recepción (pago.creadoEn),
   *  solo de registros NO ANULADO del salón. `usuarioId`/`clienteId` filtran. */
  sumPagosPorPeriodo(salonId: number, fechaInicio: Date, fechaFin: Date, usuarioId?: number, clienteId?: number): Promise<number>;
  /** Σ pagos recibidos en el período (misma "fecha de negocio del pago" que
   *  `sumPagosPorPeriodo`) cuyo REGISTRO tiene fecha de negocio ANTERIOR al inicio
   *  del período — cobros de deuda vieja. Excluye ANULADO y respeta
   *  `usuarioId`/`clienteId`. Sin deuda anterior cobrada → 0. */
  sumCobrosDeudaAnterior(salonId: number, fechaInicio: Date, fechaFin: Date, usuarioId?: number, clienteId?: number): Promise<number>;
  /** Σ pagos agrupados por mes (YYYY-MM, fecha de negocio = caja del pago),
   *  solo de registros NO ANULADO del salón, en el rango dado (Colombia). */
  sumPagosPorMes(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<Array<{ mes: string; total: number }>>;
  /** Σ montoPendiente de registros NO ANULADO del salón cuya fecha de negocio
   *  (COALESCE(fechaHora, creadoEn)) cae en el período — fiado originado. */
  sumMontoPendientePorPeriodo(salonId: number, fechaInicio: Date, fechaFin: Date, usuarioId?: number, clienteId?: number): Promise<number>;
  /** Σ montoPendiente de registros NO ANULADO con fecha de negocio ≤ hasta —
   *  deudas por cobrar acumuladas (snapshot). */
  sumMontoPendienteHasta(salonId: number, hasta: Date, usuarioId?: number, clienteId?: number): Promise<number>;
}
