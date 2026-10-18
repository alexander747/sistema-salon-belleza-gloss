import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive migration: snapshot the amount fiado at sale time (`montoFiado`).
 *
 * `montoPendiente` is mutable — it drops to 0 when the debt is collected later,
 * which made the "fiado vs cobrado" reconciliation look wrong for past days.
 * `montoFiado` freezes the unpaid amount computed when the sale was created
 * (see CreateRegistroUseCase), so a period can report how much it fiado even
 * if that debt was collected afterwards.
 *
 * Strictly additive: ADD COLUMN NULL (no default, no backfill). Production runs
 * with DB_SYNCHRONIZE=true and does not execute migrations; the entity applies
 * the column. Legacy rows keep NULL and consumers fall back to the current
 * `montoPendiente`.
 */
export class AddMontoFiadoRegistros1700000000021 implements MigrationInterface {
  name = 'AddMontoFiadoRegistros1700000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE registros_servicio ADD montoFiado DECIMAL(12,2) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE registros_servicio DROP COLUMN montoFiado`);
  }
}
