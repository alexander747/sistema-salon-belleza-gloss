import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCantidadProductosVendidos1700000000003 implements MigrationInterface {
  name = 'AddCantidadProductosVendidos1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'registros_servicio',
      new TableColumn({
        name: 'cantidadProductosVendidos',
        type: 'int',
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('registros_servicio', 'cantidadProductosVendidos');
  }
}
