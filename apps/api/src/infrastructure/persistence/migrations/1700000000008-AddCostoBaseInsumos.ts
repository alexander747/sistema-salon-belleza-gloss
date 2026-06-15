import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCostoBaseInsumos1700000000008 implements MigrationInterface {
  name = 'AddCostoBaseInsumos1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE servicios ADD costo_base_insumos DECIMAL(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE registros_servicio_items ADD costo_base_insumos DECIMAL(12,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE registros_servicio_items DROP COLUMN costo_base_insumos`,
    );
    await queryRunner.query(
      `ALTER TABLE servicios DROP COLUMN costo_base_insumos`,
    );
  }
}
