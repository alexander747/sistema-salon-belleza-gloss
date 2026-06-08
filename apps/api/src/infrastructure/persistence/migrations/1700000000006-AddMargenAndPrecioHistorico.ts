import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddMargenAndPrecioHistorico1700000000006 implements MigrationInterface {
  name = 'AddMargenAndPrecioHistorico1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add margenGanancia column to productos (default 30%)
    await queryRunner.query(
      `ALTER TABLE \`productos\` ADD \`margenGanancia\` int NOT NULL DEFAULT 30`,
    );

    // Create producto_precio_historico table
    await queryRunner.createTable(
      new Table({
        name: 'producto_precio_historico',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'productoId',
            type: 'int',
          },
          {
            name: 'precioCompra',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'precioVenta',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'cantidadAgregada',
            type: 'int',
          },
          {
            name: 'stockDespues',
            type: 'int',
          },
          {
            name: 'fecha',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'registradoPorId',
            type: 'int',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'producto_precio_historico',
      new TableForeignKey({
        columnNames: ['productoId'],
        referencedTableName: 'productos',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('producto_precio_historico');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('producto_precio_historico', fk);
      }
    }
    await queryRunner.dropTable('producto_precio_historico');
    await queryRunner.query(
      `ALTER TABLE \`productos\` DROP COLUMN \`margenGanancia\``,
    );
  }
}
