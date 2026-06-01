import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { PagoTransaccionEntity } from './PagoTransaccionEntity';
import { LiquidacionEntity } from './LiquidacionEntity';
import { DivisionRegistroEntity } from './DivisionRegistroEntity';
import { DevolucionEntity } from './DevolucionEntity';
import { ClienteEntity } from './ClienteEntity';
import { SalonEntity } from './SalonEntity';

@Entity('registros_servicio')
export class RegistroServicioEntity extends BaseEntity {
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalServicios: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalProductos: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  montoTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  propina: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  comisionCalculada: number;

  @Column({ type: 'boolean', default: false })
  esRetoque: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcionServicio: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  montoPendiente: number;

  @Column({ type: 'boolean', default: false })
  estaPagadaEmpleada: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notas: string;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @ManyToOne(() => UsuarioEntity, (usuario) => usuario.registros)
  @JoinColumn({ name: 'usuarioId' })
  usuario: UsuarioEntity;

  @Column({ type: 'int' })
  usuarioId: number;

  @ManyToOne(() => ClienteEntity, (cliente) => cliente.registros)
  @JoinColumn({ name: 'clienteId' })
  cliente: ClienteEntity;

  @Column({ type: 'int' })
  clienteId: number;

  @OneToMany(() => PagoTransaccionEntity, (pago) => pago.registroServicio, { cascade: true })
  pagos: PagoTransaccionEntity[];

  @OneToMany(() => DivisionRegistroEntity, (division) => division.registroServicio, { cascade: true })
  divisiones: DivisionRegistroEntity[];

  @OneToMany(() => DevolucionEntity, (dev) => dev.registroServicio)
  devoluciones: DevolucionEntity[];

  @ManyToOne(() => LiquidacionEntity, (liq) => liq.registros, { nullable: true })
  @JoinColumn({ name: 'liquidacionId' })
  liquidacion: LiquidacionEntity;

  @Column({ type: 'int', nullable: true })
  liquidacionId: number;
}
