import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCajaIdGastos1700000000011 implements MigrationInterface {
  name = 'AddCajaIdGastos1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE gastos ADD cajaId INT NULL`);
    await queryRunner.query(
      `ALTER TABLE gastos ADD CONSTRAINT FK_gasto_caja FOREIGN KEY (cajaId) REFERENCES cajas(id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_gasto_caja ON gastos (cajaId)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_gasto_caja ON gastos`);
    await queryRunner.query(`ALTER TABLE gastos DROP FOREIGN KEY FK_gasto_caja`);
    await queryRunner.query(`ALTER TABLE gastos DROP COLUMN cajaId`);
  }
}
