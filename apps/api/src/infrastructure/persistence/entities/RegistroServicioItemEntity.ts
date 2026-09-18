import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';

@Entity('registros_servicio_items')
export class RegistroServicioItemEntity extends BaseEntity {
  @Column({ type: 'int' })
  registroServicioId: number;

  @ManyToOne(() => RegistroServicioEntity, (registro) => registro.serviciosItems)
  @JoinColumn({ name: 'registroServicioId' })
  registroServicio: RegistroServicioEntity;

  @Column({ type: 'int' })
  servicioId: number;

  @Column({ type: 'varchar', length: 200 })
  nombreServicio: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precioServicio: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  costoBaseInsumos: number;

  /** Grams used for a `POR_GRAMO` service (per unit); null for `FIJO`/legacy items. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  gramosUsados: number | null;

  /** Catalog price per gram snapshot for a `POR_GRAMO` service; null for `FIJO`/legacy items. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  precioPorGramo: number | null;
}
