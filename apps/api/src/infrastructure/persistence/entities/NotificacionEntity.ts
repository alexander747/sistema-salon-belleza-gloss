import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { SalonEntity } from './SalonEntity';

export enum TipoNotificacion {
  DISCREPANCIA_PRECIO = 'DISCREPANCIA_PRECIO',
  PRODUCTO_NO_REGISTRADO = 'PRODUCTO_NO_REGISTRADO',
  RECOMPENSA_PENDIENTE = 'RECOMPENSA_PENDIENTE',
  STOCK_BAJO = 'STOCK_BAJO',
  DEUDA_CLIENTE = 'DEUDA_CLIENTE',
}

@Entity('notificaciones')
export class NotificacionEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: TipoNotificacion,
  })
  tipo: TipoNotificacion;

  @Column({ type: 'varchar', length: 500 })
  mensaje: string;

  @Column({ type: 'json', nullable: true })
  datos: object;

  @Column({ type: 'boolean', default: false })
  leida: boolean;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.notificaciones)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;
}
