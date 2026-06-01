import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  TARJETA = 'TARJETA',
}

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
}
