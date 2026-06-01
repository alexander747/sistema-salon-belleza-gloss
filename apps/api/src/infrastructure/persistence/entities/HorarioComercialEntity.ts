import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { SalonEntity } from './SalonEntity';

@Entity('horarios_comerciales')
export class HorarioComercialEntity extends BaseEntity {
  @Column({ type: 'int' })
  diaSemana: number;

  @Column({ type: 'varchar', length: 5, nullable: true })
  horaApertura: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  horaCierre: string;

  @Column({ type: 'boolean', default: true })
  estaAbierto: boolean;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.horarios)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;
}
