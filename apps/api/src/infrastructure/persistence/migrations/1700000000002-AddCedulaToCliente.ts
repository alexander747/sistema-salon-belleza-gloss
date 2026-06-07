import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCedulaToCliente1700000000002 implements MigrationInterface {
  name = 'AddCedulaToCliente1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'clientes',
      new TableColumn({
        name: 'cedula',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('clientes', 'cedula');
  }
}
