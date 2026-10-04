import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive migration (Rule B + Rule C):
 *  - devoluciones: metodoPago + cajaId → el arqueo resta las devoluciones EFECTIVO.
 *  - pagos_prestamo: metodoPago + cajaId → el pago de un préstamo en efectivo
 *    sale del cajón y resta del arqueo del día.
 *  - liquidaciones: metodoPago + cajaId → pagar la nómina en efectivo sale del
 *    cajón y resta del arqueo del día.
 *
 * Strictly additive: ADD COLUMN con DEFAULT/NULL. Producción corre con
 * DB_SYNCHRONIZE=true y no ejecuta migraciones — la entidad aplica la columna;
 * este archivo documenta el cambio para entornos que sí migran.
 */
export class AddMetodoPagoCajaFinanzas1700000000018 implements MigrationInterface {
  name = 'AddMetodoPagoCajaFinanzas1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── devoluciones ──
    await queryRunner.query(
      `ALTER TABLE devoluciones ADD metodoPago ENUM('EFECTIVO','TRANSFERENCIA','TARJETA') NOT NULL DEFAULT 'EFECTIVO'`,
    );
    await queryRunner.query(`ALTER TABLE devoluciones ADD cajaId INT NULL`);
    await queryRunner.query(
      `ALTER TABLE devoluciones ADD CONSTRAINT FK_devolucion_caja FOREIGN KEY (cajaId) REFERENCES cajas(id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_devolucion_caja ON devoluciones (cajaId)`);

    // ── pagos_prestamo ──
    await queryRunner.query(
      `ALTER TABLE pagos_prestamo ADD metodoPago ENUM('EFECTIVO','TRANSFERENCIA','TARJETA') NOT NULL DEFAULT 'EFECTIVO'`,
    );
    await queryRunner.query(`ALTER TABLE pagos_prestamo ADD cajaId INT NULL`);
    await queryRunner.query(
      `ALTER TABLE pagos_prestamo ADD CONSTRAINT FK_pago_prestamo_caja FOREIGN KEY (cajaId) REFERENCES cajas(id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_pago_prestamo_caja ON pagos_prestamo (cajaId)`);

    // ── liquidaciones ──
    await queryRunner.query(
      `ALTER TABLE liquidaciones ADD metodoPago ENUM('EFECTIVO','TRANSFERENCIA','TARJETA') NOT NULL DEFAULT 'EFECTIVO'`,
    );
    await queryRunner.query(`ALTER TABLE liquidaciones ADD cajaId INT NULL`);
    await queryRunner.query(
      `ALTER TABLE liquidaciones ADD CONSTRAINT FK_liquidacion_caja FOREIGN KEY (cajaId) REFERENCES cajas(id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_liquidacion_caja ON liquidaciones (cajaId)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_liquidacion_caja ON liquidaciones`);
    await queryRunner.query(`ALTER TABLE liquidaciones DROP FOREIGN KEY FK_liquidacion_caja`);
    await queryRunner.query(`ALTER TABLE liquidaciones DROP COLUMN cajaId`);
    await queryRunner.query(`ALTER TABLE liquidaciones DROP COLUMN metodoPago`);

    await queryRunner.query(`DROP INDEX idx_pago_prestamo_caja ON pagos_prestamo`);
    await queryRunner.query(`ALTER TABLE pagos_prestamo DROP FOREIGN KEY FK_pago_prestamo_caja`);
    await queryRunner.query(`ALTER TABLE pagos_prestamo DROP COLUMN cajaId`);
    await queryRunner.query(`ALTER TABLE pagos_prestamo DROP COLUMN metodoPago`);

    await queryRunner.query(`DROP INDEX idx_devolucion_caja ON devoluciones`);
    await queryRunner.query(`ALTER TABLE devoluciones DROP FOREIGN KEY FK_devolucion_caja`);
    await queryRunner.query(`ALTER TABLE devoluciones DROP COLUMN cajaId`);
    await queryRunner.query(`ALTER TABLE devoluciones DROP COLUMN metodoPago`);
  }
}
