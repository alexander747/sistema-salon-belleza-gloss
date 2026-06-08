import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { SalonEntity } from './SalonEntity';
import type { ProductoPrecioHistoricoEntity } from './ProductoPrecioHistoricoEntity';

export enum TipoInventario {
  RETAIL = 'RETAIL',
  INTERNAL = 'INTERNAL',
}

@Entity('productos')
export class ProductoEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  marca: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  color: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tamano: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  urlFoto: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precioCompra: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precioVenta: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cantidadStock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stockMinimo: number;

  @Column({
    type: 'enum',
    enum: TipoInventario,
    default: TipoInventario.RETAIL,
  })
  tipoInventario: TipoInventario;

  @Column({ type: 'int', default: 30 })
  margenGanancia: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.productos)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @OneToMany('ProductoPrecioHistoricoEntity', 'producto')
  historialPrecios: ProductoPrecioHistoricoEntity[];
}
