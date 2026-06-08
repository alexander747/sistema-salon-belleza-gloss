import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateRegistroProducto1700000000004 implements MigrationInterface {
  name = 'CreateRegistroProducto1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'registro_productos',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'registroServicioId',
            type: 'int',
          },
          {
            name: 'productoId',
            type: 'int',
          },
          {
            name: 'cantidad',
            type: 'int',
          },
          {
            name: 'precioVentaUnitario',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'creadoEn',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'actualizadoEn',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'registro_productos',
      new TableForeignKey({
        columnNames: ['registroServicioId'],
        referencedTableName: 'registros_servicio',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'registro_productos',
      new TableForeignKey({
        columnNames: ['productoId'],
        referencedTableName: 'productos',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('registro_productos');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('registro_productos', fk);
      }
    }
    await queryRunner.dropTable('registro_productos');
  }
}
