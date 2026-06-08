import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { SalonEntity } from './SalonEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { PagoPrestamoEntity } from './PagoPrestamoEntity';

export type EstadoPrestamo = 'ACTIVO' | 'PAGADO' | 'CANCELADO';

@Entity('prestamos')
export class PrestamoEntity extends BaseEntity {
  @Column({ type: 'int' })
  salonId: number;

  @ManyToOne(() => SalonEntity)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  /** Nullable — si es null, es un préstamo a tercero */
  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'usuarioId' })
  usuario: UsuarioEntity | null;

  /** Obligatorio si usuarioId es null */
  @Column({ type: 'varchar', length: 150, nullable: true })
  nombreTercero: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  saldoPendiente: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivo: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVO' })
  estado: EstadoPrestamo;

  @OneToMany(() => PagoPrestamoEntity, (pago) => pago.prestamo)
  pagos: PagoPrestamoEntity[];

  @Column({ type: 'date' })
  fechaCreacion: Date;
}
