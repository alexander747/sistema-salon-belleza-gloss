import {
  Entity,
  Column,
  Unique,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { SalonEntity } from './SalonEntity';
import { UsuarioEntity } from './UsuarioEntity';

export type EstadoCaja = 'ABIERTA' | 'CERRADA';

/**
 * Caja diaria por salón. Una sola caja por salón y día comercial (Colombia).
 * ABIERTA al inicio del día con montoInicial; CERRADA con arqueo
 * (montoEsperado vs montoRealEfectivo → diferencia).
 */
@Entity('cajas')
@Unique('UQ_caja_salon_fecha', ['salonId', 'fechaCaja'])
@Index('idx_caja_salon_estado', ['salonId', 'estado'])
export class CajaEntity extends BaseEntity {
  @ManyToOne(() => SalonEntity)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  /** Día comercial Colombia YYYY-MM-DD (getColombiaDateString). */
  @Column({ type: 'date' })
  fechaCaja: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  montoInicial: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  montoEsperado: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  montoRealEfectivo: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  diferencia: number | null;

  @Column({
    type: 'enum',
    enum: ['ABIERTA', 'CERRADA'],
    default: 'ABIERTA',
  })
  estado: EstadoCaja;

  // Auditores NULL-able: n8n no tiene req.user (apiKeyGuard no setea user)
  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'aperturaPorId' })
  aperturaPor: UsuarioEntity | null;

  @Column({ type: 'int', nullable: true })
  aperturaPorId: number | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  aperturaEn: Date;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'cierrePorId' })
  cierrePor: UsuarioEntity | null;

  @Column({ type: 'int', nullable: true })
  cierrePorId: number | null;

  @Column({ type: 'datetime', nullable: true })
  cierreEn: Date | null;
}
