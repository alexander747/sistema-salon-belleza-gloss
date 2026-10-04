import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { PrestamoEntity } from './PrestamoEntity';
import { LiquidacionEntity } from './LiquidacionEntity';
import { CajaEntity } from './CajaEntity';
import { MetodoPago } from './MetodoPago';

export type TipoPagoPrestamo = 'MANUAL' | 'LIQUIDACION';

@Entity('pagos_prestamo')
export class PagoPrestamoEntity extends BaseEntity {
  @Column({ type: 'int' })
  prestamoId: number;

  @ManyToOne(() => PrestamoEntity, (prestamo) => prestamo.pagos)
  @JoinColumn({ name: 'prestamoId' })
  prestamo: PrestamoEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: number;

  @Column({ type: 'date' })
  fechaPago: Date;

  @Column({ type: 'varchar', length: 20, default: 'MANUAL' })
  tipoPago: TipoPagoPrestamo;

  /** FK a liquidacion si el pago se originó desde una liquidación */
  @Column({ type: 'int', nullable: true })
  liquidacionId: number | null;

  @ManyToOne(() => LiquidacionEntity, { nullable: true })
  @JoinColumn({ name: 'liquidacionId' })
  liquidacion: LiquidacionEntity | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  observacion: string;

  // Egreso de caja (Rule C). Un pago MANUAL en EFECTIVO sale del cajón y debe
  // restar del arqueo del día; el método decide si afecta el arqueo (solo
  // EFECTIVO) igual que en gastos. Columna aditiva nullable/default.
  @Column({ type: 'enum', enum: MetodoPago, default: MetodoPago.EFECTIVO })
  metodoPago: MetodoPago;

  @ManyToOne(() => CajaEntity, { nullable: true })
  @JoinColumn({ name: 'cajaId' })
  caja: CajaEntity | null;

  @Column({ type: 'int', nullable: true })
  cajaId: number | null;
}
