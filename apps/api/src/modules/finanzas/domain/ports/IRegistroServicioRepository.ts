import type { QueryRunner } from 'typeorm';
import type { RegistroServicioEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';

export interface IRegistroServicioRepository {
  create(data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity>;
  findById(id: number): Promise<RegistroServicioEntity | null>;
  findBySalon(salonId: number): Promise<RegistroServicioEntity[]>;
  /** Registros con deuda pendiente (montoPendiente > 0, no ANULADO) con cliente cargado. */
  findConDeudaBySalon(salonId: number): Promise<RegistroServicioEntity[]>;
  findBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<RegistroServicioEntity[]>;
  search(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    cajaId?: number;
    skip?: number;
    take?: number;
  }): Promise<RegistroServicioEntity[]>;
  count(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    cajaId?: number;
  }): Promise<number>;
  update(id: number, data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity | null>;
  /** Σ pagos recibidos en el período por fecha de recepción (pago.creadoEn),
   *  solo de registros NO ANULADO del salón. `usuarioId`/`clienteId` filtran. */
  sumPagosPorPeriodo(salonId: number, fechaInicio: Date, fechaFin: Date, usuarioId?: number, clienteId?: number): Promise<number>;
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
