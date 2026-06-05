import {
  Entity,
  Column,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { UsuarioEntity } from './UsuarioEntity';
import { ProductoEntity } from './ProductoEntity';
import { NotificacionEntity } from './NotificacionEntity';
import { HorarioComercialEntity } from './HorarioComercialEntity';
import { GastoEntity } from './GastoEntity';
import { ClienteEntity } from './ClienteEntity';
import { CitaEntity } from './CitaEntity';
import { CategoriaServicioEntity } from './CategoriaServicioEntity';
import { CampanaMarketingEntity } from './CampanaMarketingEntity';
import { Plan } from '@pos-final/types';

export type EstadoSalon = 'ACTIVO' | 'SUSPENDIDO';

@Entity('salones')
export class SalonEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  numeroWhatsApp: string;

  @Column({ type: 'varchar', length: 100, default: 'Asistente Virtual' })
  nombreBot: string;

  @Column({ type: 'varchar', length: 20, default: 'amigable' })
  tonoVoz: string;

  @Column({
    type: 'enum',
    enum: Plan,
    default: Plan.BASIC,
  })
  plan: Plan;

  @Column({
    type: 'enum',
    enum: ['ACTIVO', 'SUSPENDIDO'],
    default: 'ACTIVO',
  })
  estado: EstadoSalon;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'varchar', length: 64, unique: true })
  apiKeyN8n: string;

  @Column({ type: 'longtext', nullable: true })
  logoUrl: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  colorPrimario: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  colorSecundario: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tema: string;

  @Column({ type: 'json', nullable: true })
  faqBase: object;

  @Column({ type: 'json', nullable: true })
  redesSociales: object;

  @Column({ type: 'int', default: 24 })
  horasCancelacion: number;

  @Column({ type: 'json', nullable: true })
  reglasTemporada: object;

  // ---- Relations ----
  @OneToMany(() => UsuarioEntity, (usuario) => usuario.salon)
  usuarios: UsuarioEntity[];

  @OneToMany(() => ClienteEntity, (cliente) => cliente.salon)
  clientes: ClienteEntity[];

  @OneToMany(() => CategoriaServicioEntity, (cat) => cat.salon)
  categorias: CategoriaServicioEntity[];

  @OneToMany(() => ProductoEntity, (producto) => producto.salon)
  productos: ProductoEntity[];

  @OneToMany(() => CitaEntity, (cita) => cita.salon)
  citas: CitaEntity[];

  @OneToMany(() => GastoEntity, (gasto) => gasto.salon)
  gastos: GastoEntity[];

  @OneToMany(() => HorarioComercialEntity, (horario) => horario.salon)
  horarios: HorarioComercialEntity[];

  @OneToMany(() => CampanaMarketingEntity, (campana) => campana.salon)
  campanas: CampanaMarketingEntity[];

  @OneToMany(() => NotificacionEntity, (notif) => notif.salon)
  notificaciones: NotificacionEntity[];
}
