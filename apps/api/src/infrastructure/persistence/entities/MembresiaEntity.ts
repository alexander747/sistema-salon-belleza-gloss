import {
  Entity,
  Column,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';

export enum PlanMembresia {
  BASICO = 'BASICO',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum EstadoMembresia {
  ACTIVA = 'ACTIVA',
  SUSPENDIDA = 'SUSPENDIDA',
  CANCELADA = 'CANCELADA',
}

/**
 * Tenant subscription/plan entity.
 * Tracks the billing plan and status for each salon tenant.
 */
@Entity('membresias')
export class MembresiaEntity extends BaseEntity {
  @Column({ type: 'int' })
  salonId: number;

  @Column({
    type: 'enum',
    enum: PlanMembresia,
    default: PlanMembresia.BASICO,
  })
  plan: PlanMembresia;

  @Column({
    type: 'enum',
    enum: EstadoMembresia,
    default: EstadoMembresia.ACTIVA,
  })
  estado: EstadoMembresia;

  @Column({ type: 'datetime' })
  fechaInicio: Date;

  @Column({ type: 'datetime', nullable: true })
  fechaFin: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monto: number;
}
