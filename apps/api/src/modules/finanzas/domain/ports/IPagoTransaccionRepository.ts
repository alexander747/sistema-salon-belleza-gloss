import type { QueryRunner } from 'typeorm';
import type { PagoTransaccionEntity } from '../../../../infrastructure/persistence/entities/PagoTransaccionEntity';

export interface IPagoTransaccionRepository {
  create(data: Partial<PagoTransaccionEntity>, queryRunner?: QueryRunner): Promise<PagoTransaccionEntity>;
  findByRegistro(registroServicioId: number): Promise<PagoTransaccionEntity[]>;
  bulkCreate(data: Partial<PagoTransaccionEntity>[], queryRunner?: QueryRunner): Promise<PagoTransaccionEntity[]>;
  /**
   * Pagos que pertenecen a la caja C (arqueo): `pago.cajaId = C` (pagos de la
   * caja y abonos posteriores) UNION los pagos legacy `pago.cajaId IS NULL`
   * cuyo registro pertenece a C (`registro.cajaId = C`, no ANULADO).
   * Cada pago cuenta en UNA sola caja — sin doble conteo.
   */
  findByCajaConFallback(cajaId: number): Promise<PagoTransaccionEntity[]>;
}
