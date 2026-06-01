import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RecompensaFidelidadEntity } from './RecompensaFidelidadEntity';
import { FotoPortafolioEntity } from './FotoPortafolioEntity';
import { CitaEntity } from './CitaEntity';
import { CategoriaServicioEntity } from './CategoriaServicioEntity';

@Entity('servicios')
export class ServicioEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precioBase: number;

  @Column({ type: 'int', default: 60 })
  duracionMinutos: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // ---- Relations ----
  @ManyToOne(() => CategoriaServicioEntity, (cat) => cat.servicios, { nullable: true })
  @JoinColumn({ name: 'categoriaId' })
  categoria: CategoriaServicioEntity | null;

  @Column({ type: 'int', nullable: true })
  categoriaId: number | null;

  @OneToMany(() => FotoPortafolioEntity, (foto) => foto.servicio)
  fotos: FotoPortafolioEntity[];

  @ManyToMany(() => CitaEntity, (cita) => cita.servicios)
  citas: CitaEntity[];

  @OneToMany(() => RecompensaFidelidadEntity, (r) => r.servicio)
  recompensas: RecompensaFidelidadEntity[];
}
