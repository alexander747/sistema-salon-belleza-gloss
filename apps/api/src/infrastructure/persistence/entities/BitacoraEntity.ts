import {
  Entity,
  Column,
} from 'typeorm';
import { BaseEntity } from './BaseEntity';

export enum NivelBitacora {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum MetodoBitacora {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

/**
 * Audit log entity that records every API request to the backend.
 * Captures request/response data, error stack traces, and user context
 * for security auditing and debugging.
 */
@Entity('bitacora')
export class BitacoraEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: NivelBitacora,
    default: NivelBitacora.INFO,
  })
  nivel: NivelBitacora;

  @Column({
    type: 'enum',
    enum: MetodoBitacora,
  })
  metodo: MetodoBitacora;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  accion: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  mensaje: string;

  @Column({ type: 'json', nullable: true })
  requestData: object | null;

  @Column({ type: 'json', nullable: true })
  responseData: object | null;

  @Column({ type: 'int', nullable: true })
  statusCode: number;

  @Column({ type: 'text', nullable: true })
  stackTrace: string | null;

  @Column({ type: 'json', nullable: true })
  datosExtra: object | null;

  @Column({ type: 'int', nullable: true })
  salonId: number | null;

  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nombreSalon: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nombreUsuario: string;
}
