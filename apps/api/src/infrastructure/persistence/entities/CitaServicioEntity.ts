import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { CitaEntity } from './CitaEntity';
import { ServicioEntity } from './ServicioEntity';

/**
 * Explicit join entity for the `citas_servicios` table.
 *
 * Column/property names follow the REAL schema:
 * `citas_servicios(citasId INT, serviciosId INT, cantidad INT)` — TypeORM
 * `synchronize` naming (`citasId`/`serviciosId`), NOT the stale
 * `InitialSchema` migration names (`citaId`/`servicioId`). Production was
 * never migrated (deploys run `DB_SYNCHRONIZE=true`), so standardizing on the
 * migration names would require a destructive rename. This entity maps the
 * live columns as-is and only ADDS `cantidad`.
 */
@Entity('citas_servicios')
export class CitaServicioEntity {
  @PrimaryColumn({ type: 'int', name: 'citasId' })
  citasId: number;

  @PrimaryColumn({ type: 'int', name: 'serviciosId' })
  serviciosId: number;

  @Column({ type: 'int', default: 1 })
  cantidad: number;

  // ---- Relations ----
  @ManyToOne(() => CitaEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'citasId' })
  cita: CitaEntity;

  @ManyToOne(() => ServicioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviciosId' })
  servicio: ServicioEntity;
}
