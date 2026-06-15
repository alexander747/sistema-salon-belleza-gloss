import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateRegistroServicioItem1700000000007 implements MigrationInterface {
  name = 'CreateRegistroServicioItem1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'registros_servicio_items',
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
            name: 'servicioId',
            type: 'int',
          },
          {
            name: 'nombreServicio',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'precioServicio',
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
      'registros_servicio_items',
      new TableForeignKey({
        columnNames: ['registroServicioId'],
        referencedTableName: 'registros_servicio',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('registros_servicio_items');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('registros_servicio_items', fk);
      }
    }
    await queryRunner.dropTable('registros_servicio_items');
  }
}
