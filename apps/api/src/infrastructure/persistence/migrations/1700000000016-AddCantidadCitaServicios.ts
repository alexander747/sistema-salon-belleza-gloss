import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR3 — Quantity per service in citas. Purely ADDITIVE: adds `cantidad` with a
 * default of 1 to the existing join table, so legacy rows read as `cantidad=1`.
 *
 * Column names follow the REAL schema. The live table is
 * `citas_servicios(citasId INT, serviciosId INT)` (TypeORM `synchronize`
 * naming); production was never migrated (deploys run `DB_SYNCHRONIZE=true`),
 * so we must NOT rename `citaId/servicioId` — only add `cantidad`.
 */
export class AddCantidadCitaServicios1700000000016 implements MigrationInterface {
  name = 'AddCantidadCitaServicios1700000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE citas_servicios ADD cantidad INT NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE citas_servicios DROP COLUMN cantidad`);
  }
}
