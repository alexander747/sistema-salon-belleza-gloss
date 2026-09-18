import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { ClienteEntity } from './ClienteEntity';
import { SalonEntity } from './SalonEntity';
import { CitaServicioEntity } from './CitaServicioEntity';

export enum EstadoCita {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
  NO_LLEGO = 'NO_LLEGO',
}

@Entity('citas')
export class CitaEntity extends BaseEntity {
  @Column({ type: 'datetime' })
  fechaHora: Date;

  @Column({
    type: 'enum',
    enum: EstadoCita,
    default: EstadoCita.PENDIENTE,
  })
  estado: EstadoCita;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notas: string;

  @Column({ type: 'boolean', default: false })
  esWalkIn: boolean;

  @Column({ type: 'boolean', default: false })
  notificadaCancelacion: boolean;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivoCancelacion: string;

  // ---- Auditor columns ----
  @Column({ type: 'int', nullable: true })
  confirmadoPorId: number;

  @Column({ type: 'int', nullable: true })
  completadoPorId: number;

  @Column({ type: 'int', nullable: true })
  canceladoPorId: number;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.citas)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @ManyToOne(() => UsuarioEntity, (usuario) => usuario.citas)
  @JoinColumn({ name: 'usuarioId' })
  usuario: UsuarioEntity;

  @Column({ type: 'int' })
  usuarioId: number;

  @ManyToOne(() => ClienteEntity, (cliente) => cliente.citas)
  @JoinColumn({ name: 'clienteId' })
  cliente: ClienteEntity;

  @Column({ type: 'int' })
  clienteId: number;

  /**
   * Explicit join to `citas_servicios` (citasId / serviciosId / cantidad).
   * Replaces the previous `@ManyToMany` because TypeORM cannot expose extra
   * join columns, and duplicate M:N rows are blocked by the composite PK.
   */
  @OneToMany(() => CitaServicioEntity, (cs) => cs.cita, { cascade: true })
  citasServicios: CitaServicioEntity[];
}
