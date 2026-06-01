import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';

@Entity('divisiones_registro')
export class DivisionRegistroEntity extends BaseEntity {
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  porcentajeParticipacion: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  comisionCorrespondiente: number;

  // ---- Relations ----
  @ManyToOne(() => RegistroServicioEntity, (registro) => registro.divisiones)
  @JoinColumn({ name: 'registroServicioId' })
  registroServicio: RegistroServicioEntity;

  @Column({ type: 'int' })
  registroServicioId: number;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'usuarioId' })
  usuario: UsuarioEntity;

  @Column({ type: 'int' })
  usuarioId: number;
}
