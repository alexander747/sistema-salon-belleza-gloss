import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { SalonEntity } from './SalonEntity';

export enum TipoBloqueo {
  PARCIAL = 'PARCIAL',
  TOTAL = 'TOTAL',
}

@Entity('bloqueos_agenda')
export class BloqueoAgendaEntity extends BaseEntity {
  @Column({ type: 'datetime' })
  fechaInicio: Date;

  @Column({ type: 'datetime' })
  fechaFin: Date;

  @Column({
    type: 'enum',
    enum: TipoBloqueo,
    default: TipoBloqueo.PARCIAL,
  })
  tipo: TipoBloqueo;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo: string;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.citas)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @ManyToOne(() => UsuarioEntity, (usuario) => usuario.bloqueos, { nullable: true })
  @JoinColumn({ name: 'usuarioId' })
  usuario: UsuarioEntity | null;

  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;
}
