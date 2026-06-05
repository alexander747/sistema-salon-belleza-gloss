import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPriceAdjustmentFields1700000000001 implements MigrationInterface {
  name = 'AddPriceAdjustmentFields1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('registros_servicio', [
      new TableColumn({
        name: 'precioAjustado',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'porcentajeDescuento',
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'valorOriginal',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'valorFinal',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('registros_servicio', [
      'precioAjustado',
      'porcentajeDescuento',
      'valorOriginal',
      'valorFinal',
    ]);
  }
}
