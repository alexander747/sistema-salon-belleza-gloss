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
}
