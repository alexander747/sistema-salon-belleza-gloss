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

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;
}
