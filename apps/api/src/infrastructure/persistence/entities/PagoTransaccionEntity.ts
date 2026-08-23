import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';
import { CajaEntity } from './CajaEntity';
import { MetodoPago } from './MetodoPago';

// Re-export para compatibilidad con los importers existentes (use cases y tests).
export { MetodoPago };

@Entity('pagos_transaccion')
export class PagoTransaccionEntity extends BaseEntity {
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: number;

  @Column({
    type: 'enum',
    enum: MetodoPago,
    default: MetodoPago.EFECTIVO,
  })
  metodoPago: MetodoPago;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string;

  // ---- Relations ----
  @ManyToOne(() => RegistroServicioEntity, (registro) => registro.pagos)
  @JoinColumn({ name: 'registroServicioId' })
  registroServicio: RegistroServicioEntity;

  @Column({ type: 'int' })
  registroServicioId: number;

  // Caja donde se RECIBIÓ el dinero (fecha de recepción del pago).
  // NULL para pagos legacy (anteriores a la columna): el arqueo cae al fallback
  // por `registro.cajaId`. Los abonos posteriores siempre llevan la caja de hoy.
  // DB_SYNCHRONIZE=true crea la columna automáticamente (nullable, sin downtime).
  @ManyToOne(() => CajaEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cajaId' })
  caja: CajaEntity | null;

  @Column({ type: 'int', nullable: true })
  cajaId: number | null;
}
