import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';
import { ProductoEntity } from './ProductoEntity';

@Entity('registro_productos')
export class RegistroProductoEntity extends BaseEntity {
  @Column({ type: 'int' })
  registroServicioId: number;

  @ManyToOne(() => RegistroServicioEntity, (registro) => registro.productosVendidos)
  @JoinColumn({ name: 'registroServicioId' })
  registroServicio: RegistroServicioEntity;

  @Column({ type: 'int' })
  productoId: number;

  @ManyToOne(() => ProductoEntity)
  @JoinColumn({ name: 'productoId' })
  producto: ProductoEntity;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precioVentaUnitario: number;

  /**
   * COGS: the product's purchase cost frozen at SALE time (from
   * `ProductoEntity.precioCompra`). Nullable so the additive column applies to
   * existing (legacy) rows without a destructive migration; legacy nulls fall
   * back to the current catalog `precioCompra` in the P&L.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  costoUnitario: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;
}
