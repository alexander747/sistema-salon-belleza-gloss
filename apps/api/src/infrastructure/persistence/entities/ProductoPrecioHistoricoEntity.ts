import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { ProductoEntity } from './ProductoEntity';

@Entity('producto_precio_historico')
export class ProductoPrecioHistoricoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  productoId: number;

  @ManyToOne(() => ProductoEntity, (p) => p.historialPrecios)
  @JoinColumn({ name: 'productoId' })
  producto: ProductoEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precioCompra: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precioVenta: number;

  @Column({ type: 'int' })
  cantidadAgregada: number;

  @Column({ type: 'int' })
  stockDespues: number;

  @CreateDateColumn()
  fecha: Date;

  @Column({ type: 'int', nullable: true })
  registradoPorId: number | null;
}
