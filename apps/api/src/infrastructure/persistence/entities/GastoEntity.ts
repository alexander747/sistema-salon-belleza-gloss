import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { MetodoPago } from './PagoTransaccionEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { SalonEntity } from './SalonEntity';

@Entity('gastos')
export class GastoEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 300 })
  descripcion: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: number;

  @Column({
    type: 'enum',
    enum: MetodoPago,
    default: MetodoPago.EFECTIVO,
  })
  metodoPago: MetodoPago;

  @Column({ type: 'boolean', default: false })
  esGastoFijo: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  categoria: string;

  @Column({ type: 'date' })
  fecha: Date;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.gastos)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'reportadoPorId' })
  reportadoPor: UsuarioEntity | null;

  @Column({ type: 'int', nullable: true })
  reportadoPorId: number | null;
}
