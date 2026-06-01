import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { ServicioEntity } from './ServicioEntity';

@Entity('fotos_portafolio')
export class FotoPortafolioEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 500 })
  urlFoto: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion: string;

  @Column({ type: 'boolean', default: false })
  esFotoTrabajo: boolean;

  @Column({ type: 'boolean', default: true })
  visible: boolean;

  // ---- Relations ----
  @ManyToOne(() => ServicioEntity, (servicio) => servicio.fotos)
  @JoinColumn({ name: 'servicioId' })
  servicio: ServicioEntity;

  @Column({ type: 'int' })
  servicioId: number;

  @ManyToOne(() => UsuarioEntity, (usuario) => usuario.fotosPortafolio, { nullable: true })
  @JoinColumn({ name: 'usuarioId' })
  usuario: UsuarioEntity | null;

  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;
}
