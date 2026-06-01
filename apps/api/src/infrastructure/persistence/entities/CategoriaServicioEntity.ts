import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { ServicioEntity } from './ServicioEntity';
import { SalonEntity } from './SalonEntity';

@Entity('categorias_servicio')
export class CategoriaServicioEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  emoji: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.categorias)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @OneToMany(() => ServicioEntity, (servicio) => servicio.categoria)
  servicios: ServicioEntity[];
}
