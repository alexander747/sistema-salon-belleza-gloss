import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';
import { ProductoEntity } from './ProductoEntity';
import { SalonEntity } from './SalonEntity';

@Entity('devoluciones')
export class DevolucionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 300 })
  motivo: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  montoDevolucion: number;

  @Column({ type: 'boolean', default: true })
  regresaAlStock: boolean;

  @Column({ type: 'boolean', default: false })
  procesada: boolean;

  // ---- Relations ----
  @ManyToOne(() => RegistroServicioEntity, (registro) => registro.devoluciones)
  @JoinColumn({ name: 'registroServicioId' })
  registroServicio: RegistroServicioEntity;

  @Column({ type: 'int' })
  registroServicioId: number;

  @ManyToOne(() => ProductoEntity, { nullable: true })
  @JoinColumn({ name: 'productoId' })
  producto: ProductoEntity | null;

  @Column({ type: 'int', nullable: true })
  productoId: number | null;

  @ManyToOne(() => SalonEntity)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;
}
