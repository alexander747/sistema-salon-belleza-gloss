import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { RegistroServicioEntity } from './RegistroServicioEntity';
import { FotoPortafolioEntity } from './FotoPortafolioEntity';
import { CitaEntity } from './CitaEntity';
import { BloqueoAgendaEntity } from './BloqueoAgendaEntity';
import { SalonEntity } from './SalonEntity';
import { Rol } from '@pos-final/types';

@Entity('usuarios')
export class UsuarioEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 20 })
  numeroWhatsApp: string;

  @Column({ type: 'varchar', length: 200 })
  email: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ type: 'int', default: Rol.DUEÑA })
  rol: Rol;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  porcentajeComisionServicio: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sueldoFijo: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  bonoHorario: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  frecuenciaBono: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  refreshTokenFamily: string | null;

  // ---- Relations ----
  @ManyToOne(() => SalonEntity, (salon) => salon.usuarios)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column({ type: 'int', nullable: true })
  salonId: number | null;

  @OneToMany(() => CitaEntity, (cita) => cita.usuario)
  citas: CitaEntity[];

  @OneToMany(() => RegistroServicioEntity, (registro) => registro.usuario)
  registros: RegistroServicioEntity[];

  @OneToMany(() => BloqueoAgendaEntity, (bloqueo) => bloqueo.usuario)
  bloqueos: BloqueoAgendaEntity[];

  @OneToMany(() => FotoPortafolioEntity, (foto) => foto.usuario)
  fotosPortafolio: FotoPortafolioEntity[];
}
