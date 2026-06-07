import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';
import { RecompensaFidelidadEntity } from './RecompensaFidelidadEntity';
import { CitaEntity } from './CitaEntity';
import { SalonEntity } from './SalonEntity';

@Entity('clientes')
export class ClienteEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cedula: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string;

  @Column({ type: 'int', default: 100 })
  puntajeConfianza: number;

  @Column({ type: 'int', default: 0 })
  cantidadNoShows: number;

  @Column({ type: 'int', default: 0 })
  puntosFidelidad: number;

  @Column({ type: 'int', default: 0 })
  totalServicios: number;

  @Column({ type: 'datetime', nullable: true })
  ultimaVisita: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  deudaTotal: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  servicioFrecuente: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.clientes)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int' })
  salonId: number;

  @OneToMany(() => CitaEntity, (cita) => cita.cliente)
  citas: CitaEntity[];

  @OneToMany(() => RegistroServicioEntity, (registro) => registro.cliente)
  registros: RegistroServicioEntity[];

  @OneToMany(() => RecompensaFidelidadEntity, (recompensa) => recompensa.cliente)
  recompensas: RecompensaFidelidadEntity[];
}
