import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive migration (COGS): snapshot the product purchase cost on each sold
 * line so the P&L can subtract the cost of goods actually SOLD (not the
 * inventory purchase, which is an asset).
 *
 * Strictly additive: ADD COLUMN NULL (no default, no backfill). Production runs
 * with DB_SYNCHRONIZE=true and does not execute migrations — the entity applies
 * the column; this file documents the change for environments that do migrate.
 * Legacy rows keep NULL and the P&L falls back to the current catalog
 * `precioCompra`.
 */
export class AddCostoUnitarioRegistroProductos1700000000019 implements MigrationInterface {
  name = 'AddCostoUnitarioRegistroProductos1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE registro_productos ADD costoUnitario DECIMAL(12,2) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE registro_productos DROP COLUMN costoUnitario`);
  }
}
