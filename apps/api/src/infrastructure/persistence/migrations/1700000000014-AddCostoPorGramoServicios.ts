import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR1 — Catalog cost mode: `FIJO` (default, uses `costoBaseInsumos`) or
 * `POR_GRAMO` (uses `precioPorGramo`). Additive and backwards compatible:
 * existing rows read as `FIJO` with a null price.
 *
 * Column names follow the real schema (`InitialSchema` uses camelCase, e.g.
 * `precioBase`, `categoriaId`) — not the legacy snake_case used by 008.
 */
export class AddCostoPorGramoServicios1700000000014 implements MigrationInterface {
  name = 'AddCostoPorGramoServicios1700000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE servicios ADD tipoCostoInsumo VARCHAR(20) NOT NULL DEFAULT 'FIJO'`,
    );
    await queryRunner.query(
      `ALTER TABLE servicios ADD precioPorGramo DECIMAL(12,2) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE servicios DROP COLUMN precioPorGramo`);
    await queryRunner.query(`ALTER TABLE servicios DROP COLUMN tipoCostoInsumo`);
  }
}
