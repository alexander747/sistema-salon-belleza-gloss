import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';
import { ProductoEntity } from './ProductoEntity';
import { SalonEntity } from './SalonEntity';
import { CajaEntity } from './CajaEntity';
import { MetodoPago } from './MetodoPago';

@Entity('devoluciones')
export class DevolucionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 300 })
  motivo: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  montoDevolucion: number;

  @Column({ type: 'boolean', default: true })
  regresaAlStock: boolean;

  @Column({ type: 'boolean', default: false })
  procesada: boolean;

  // Cómo se reintegró el dinero (Rule B). El arqueo es cash-only: solo las
  // devoluciones EFECTIVO reducen el esperado; TRANSFERENCIA/TARJETA no tocan
  // el cajón (pero sí el P&L, que resta todas). Default EFECTIVO para filas
  // históricas (columna aditiva, prod corre con DB_SYNCHRONIZE=true).
  @Column({ type: 'enum', enum: MetodoPago, default: MetodoPago.EFECTIVO })
  metodoPago: MetodoPago;

  // ---- Relations ----
  @ManyToOne(() => RegistroServicioEntity, (registro) => registro.devoluciones)
  @JoinColumn({ name: 'registroServicioId' })
  registroServicio: RegistroServicioEntity;

  @Column({ type: 'int' })
  registroServicioId: number;

  @ManyToOne(() => ProductoEntity, { nullable: true })
  @JoinColumn({ name: 'productoId' })
  producto: ProductoEntity | null;

  @Column({ type: 'int', nullable: true })
  productoId: number | null;

  @ManyToOne(() => SalonEntity)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  // Caja donde se hizo el reintegro (misma asociación que los gastos). NULL en
  // filas históricas; las nuevas devoluciones siempre caen en la caja abierta
  // del día, de modo que el arqueo de ESA caja resta su parte EFECTIVO.
  @ManyToOne(() => CajaEntity, { nullable: true })
  @JoinColumn({ name: 'cajaId' })
  caja: CajaEntity | null;

  @Column({ type: 'int', nullable: true })
  cajaId: number | null;
}
