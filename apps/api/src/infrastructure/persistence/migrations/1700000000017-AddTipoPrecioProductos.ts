import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist the product price mode. Purely ADDITIVE: `ADD COLUMN` with a
 * `DEFAULT 'MARGEN'`, so every existing row keeps today's recompute-always
 * behavior until the application-level backfill flips zero-cost/fixed-price
 * rows to `FIJO`.
 *
 * Production runs with `DB_SYNCHRONIZE=true` and does NOT run migrations, so
 * this file documents the contract while `synchronize` adds the same column.
 * The matching backfill in `initializeDatabase()` covers both paths.
 */
export class AddTipoPrecioProductos1700000000017 implements MigrationInterface {
  name = 'AddTipoPrecioProductos1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`productos\` ADD \`tipoPrecio\` varchar(10) NOT NULL DEFAULT 'MARGEN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`productos\` DROP COLUMN \`tipoPrecio\``);
  }
}
