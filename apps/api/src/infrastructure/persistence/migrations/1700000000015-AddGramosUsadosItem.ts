import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR2 — Per-gram real cost snapshot on walk-in sale items. Additive and
 * backwards compatible: legacy rows keep a null gram snapshot and their
 * original `costoBaseInsumos`.
 *
 * Column names follow the real schema (`InitialSchema` uses camelCase, e.g.
 * `precioServicio`, `costoBaseInsumos`) — not the legacy snake_case used by 008.
 */
export class AddGramosUsadosItem1700000000015 implements MigrationInterface {
  name = 'AddGramosUsadosItem1700000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE registros_servicio_items ADD gramosUsados DECIMAL(12,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE registros_servicio_items ADD precioPorGramo DECIMAL(12,2) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE registros_servicio_items DROP COLUMN precioPorGramo`,
    );
    await queryRunner.query(
      `ALTER TABLE registros_servicio_items DROP COLUMN gramosUsados`,
    );
  }
}
