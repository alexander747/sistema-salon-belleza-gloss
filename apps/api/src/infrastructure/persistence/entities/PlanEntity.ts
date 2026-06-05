import { Entity, Column } from 'typeorm';
import { BaseEntity } from './BaseEntity';

@Entity('planes')
export class PlanEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precioMensual: number;

  @Column({ type: 'int', default: 5 })
  maxEmpleadas: number;

  @Column({ type: 'int', default: 1 })
  maxSucursales: number;

  @Column({ type: 'simple-json', nullable: true })
  features: string[];

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
