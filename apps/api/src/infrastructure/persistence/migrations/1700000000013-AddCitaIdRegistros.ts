import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCitaIdRegistros1700000000013 implements MigrationInterface {
  name = 'AddCitaIdRegistros1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE registros_servicio ADD citaId INT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE registros_servicio ADD CONSTRAINT FK_reg_cita FOREIGN KEY (citaId) REFERENCES citas(id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_reg_cita ON registros_servicio (citaId)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_reg_cita ON registros_servicio`);
    await queryRunner.query(
      `ALTER TABLE registros_servicio DROP FOREIGN KEY FK_reg_cita`,
    );
    await queryRunner.query(
      `ALTER TABLE registros_servicio DROP COLUMN citaId`,
    );
  }
}
