import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCajaIdRegistros1700000000010 implements MigrationInterface {
  name = 'AddCajaIdRegistros1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE registros_servicio ADD cajaId INT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE registros_servicio ADD CONSTRAINT FK_reg_caja FOREIGN KEY (cajaId) REFERENCES cajas(id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_reg_caja ON registros_servicio (cajaId)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_reg_caja ON registros_servicio`);
    await queryRunner.query(
      `ALTER TABLE registros_servicio DROP FOREIGN KEY FK_reg_caja`,
    );
    await queryRunner.query(
      `ALTER TABLE registros_servicio DROP COLUMN cajaId`,
    );
  }
}
