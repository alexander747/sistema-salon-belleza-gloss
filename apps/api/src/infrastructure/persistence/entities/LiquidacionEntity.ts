import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';
import { SalonEntity } from './SalonEntity';

@Entity('liquidaciones')
export class LiquidacionEntity extends BaseEntity {
  @Column({ type: 'date' })
  fechaDesde: Date;

  @Column({ type: 'date' })
  fechaHasta: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalServicios: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalComisiones: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPropinas: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sueldoFijo: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  bonoHorario: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPagado: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estado: string;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'usuarioId' })
  usuario: UsuarioEntity;

  @Column({ type: 'int' })
  usuarioId: number;

  @OneToMany(() => RegistroServicioEntity, (registro) => registro.liquidacion)
  registros: RegistroServicioEntity[];
}
