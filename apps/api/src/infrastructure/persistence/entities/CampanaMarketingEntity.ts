import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { SalonEntity } from './SalonEntity';

export enum FiltroCampana {
  TODOS = 'TODOS',
  VIP = 'VIP',
  INACTIVOS = 'INACTIVOS',
  POR_SERVICIO = 'POR_SERVICIO',
}

export enum EstadoCampana {
  BORRADOR = 'BORRADOR',
  ENVIADA = 'ENVIADA',
}

@Entity('campanas_marketing')
export class CampanaMarketingEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  urlImagen: string;

  @Column({
    type: 'enum',
    enum: FiltroCampana,
    default: FiltroCampana.TODOS,
  })
  filtro: FiltroCampana;

  @Column({ type: 'int', nullable: true })
  servicioFiltroId: number | null;

  @Column({ type: 'int', nullable: true })
  topN: number | null;

  @Column({ type: 'int', nullable: true })
  diasInactividad: number | null;

  @Column({ type: 'int', default: 0 })
  totalEnviados: number;

  @Column({
    type: 'enum',
    enum: EstadoCampana,
    default: EstadoCampana.BORRADOR,
  })
  estado: EstadoCampana;

  @Column({ type: 'datetime', nullable: true })
  fechaEnvio: Date;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.campanas)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;
}
