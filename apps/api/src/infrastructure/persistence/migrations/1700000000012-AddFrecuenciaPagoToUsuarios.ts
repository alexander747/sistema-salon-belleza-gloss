import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFrecuenciaPagoToUsuarios1700000000012 implements MigrationInterface {
  name = 'AddFrecuenciaPagoToUsuarios1700000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'usuarios',
      new TableColumn({
        name: 'frecuenciaPago',
        type: 'varchar',
        length: '20',
        isNullable: false,
        default: "'MENSUAL'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('usuarios', 'frecuenciaPago');
  }
}
