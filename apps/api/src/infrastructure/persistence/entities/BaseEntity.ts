import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Abstract base entity providing common columns for all entities:
 * - id: Primary key (auto-increment)
 * - creadoEn: Auto-set on creation
 * - actualizadoEn: Auto-set on creation and updated on modification
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
