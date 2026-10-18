import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive migration: opening cash capital on the salon (`saldoInicialCaja`).
 *
 * It is the cash the business already had BEFORE using the system — the start
 * of the cash position, NOT income. Strictly additive: ADD COLUMN NULL DEFAULT 0
 * (no backfill, no rename). Production runs with DB_SYNCHRONIZE=true and does
 * not execute migrations; the entity applies the column. This file documents the
 * change for environments that do migrate.
 */
export class AddSaldoInicialCajaSalones1700000000020 implements MigrationInterface {
  name = 'AddSaldoInicialCajaSalones1700000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE salones ADD saldoInicialCaja DECIMAL(12,2) NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE salones DROP COLUMN saldoInicialCaja`);
  }
}
