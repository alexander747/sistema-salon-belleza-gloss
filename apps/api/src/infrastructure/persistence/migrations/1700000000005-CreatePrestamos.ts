import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreatePrestamos1700000000005 implements MigrationInterface {
  name = 'CreatePrestamos1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'prestamos',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'salonId',
            type: 'int',
          },
          {
            name: 'usuarioId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'nombreTercero',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'monto',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'saldoPendiente',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'motivo',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          {
            name: 'estado',
            type: 'varchar',
            length: '20',
            default: "'ACTIVO'",
          },
          {
            name: 'fechaCreacion',
            type: 'date',
            default: 'CURRENT_DATE',
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
      'prestamos',
      new TableForeignKey({
        columnNames: ['salonId'],
        referencedTableName: 'salones',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'prestamos',
      new TableForeignKey({
        columnNames: ['usuarioId'],
        referencedTableName: 'usuarios',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'pagos_prestamo',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'prestamoId',
            type: 'int',
          },
          {
            name: 'monto',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'fechaPago',
            type: 'date',
            default: 'CURRENT_DATE',
          },
          {
            name: 'tipoPago',
            type: 'varchar',
            length: '20',
            default: "'MANUAL'",
          },
          {
            name: 'liquidacionId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'observacion',
            type: 'varchar',
            length: '300',
            isNullable: true,
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
      'pagos_prestamo',
      new TableForeignKey({
        columnNames: ['prestamoId'],
        referencedTableName: 'prestamos',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'pagos_prestamo',
      new TableForeignKey({
        columnNames: ['liquidacionId'],
        referencedTableName: 'liquidaciones',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const pagosTable = await queryRunner.getTable('pagos_prestamo');
    if (pagosTable) {
      for (const fk of pagosTable.foreignKeys) {
        await queryRunner.dropForeignKey('pagos_prestamo', fk);
      }
    }
    await queryRunner.dropTable('pagos_prestamo');

    const prestamosTable = await queryRunner.getTable('prestamos');
    if (prestamosTable) {
      for (const fk of prestamosTable.foreignKeys) {
        await queryRunner.dropForeignKey('prestamos', fk);
      }
    }
    await queryRunner.dropTable('prestamos');
  }
}
