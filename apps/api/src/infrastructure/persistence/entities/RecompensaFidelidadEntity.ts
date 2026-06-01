import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { ServicioEntity } from './ServicioEntity';
import { ClienteEntity } from './ClienteEntity';
import { SalonEntity } from './SalonEntity';

export enum EstadoRecompensa {
  PENDIENTE_APROBACION = 'PENDIENTE_APROBACION',
  APROBADA_Y_NOTIFICADA = 'APROBADA_Y_NOTIFICADA',
  CANJEADA = 'CANJEADA',
}

@Entity('recompensas_fidelidad')
export class RecompensaFidelidadEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 300 })
  descripcion: string;

  @Column({ type: 'int' })
  serviciosRequeridos: number;

  @Column({
    type: 'enum',
    enum: EstadoRecompensa,
    default: EstadoRecompensa.PENDIENTE_APROBACION,
  })
  estado: EstadoRecompensa;

  @Column({ type: 'datetime', nullable: true })
  fechaAprobacion: Date;

  @Column({ type: 'datetime', nullable: true })
  fechaCanje: Date;

  // ---- Relations ----
  @ManyToOne(() => ClienteEntity, (cliente) => cliente.recompensas)
  @JoinColumn({ name: 'clienteId' })
  cliente: ClienteEntity;

  @Column({ type: 'int' })
  clienteId: number;

  @ManyToOne(() => ServicioEntity, (servicio) => servicio.recompensas, { nullable: true })
  @JoinColumn({ name: 'servicioId' })
  servicio: ServicioEntity | null;

  @Column({ type: 'int', nullable: true })
  servicioId: number | null;

  @ManyToOne(() => SalonEntity)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;
}
