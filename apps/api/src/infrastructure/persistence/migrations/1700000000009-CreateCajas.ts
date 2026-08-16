import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCajas1700000000009 implements MigrationInterface {
  name = 'CreateCajas1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE cajas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        salonId INT NOT NULL,
        fechaCaja DATE NOT NULL,
        montoInicial DECIMAL(12,2) NOT NULL DEFAULT 0,
        montoEsperado DECIMAL(12,2) NULL,
        montoRealEfectivo DECIMAL(12,2) NULL,
        diferencia DECIMAL(12,2) NULL,
        estado ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
        aperturaPorId INT NULL,
        aperturaEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        cierrePorId INT NULL,
        cierreEn DATETIME NULL,
        creadoEn DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        actualizadoEn DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT caja_salon_fecha UNIQUE (salonId, fechaCaja),
        CONSTRAINT FK_caja_salon FOREIGN KEY (salonId) REFERENCES salones(id),
        CONSTRAINT FK_caja_apertura FOREIGN KEY (aperturaPorId) REFERENCES usuarios(id),
        CONSTRAINT FK_caja_cierre FOREIGN KEY (cierrePorId) REFERENCES usuarios(id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_caja_salon_estado ON cajas (salonId, estado)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE cajas`);
  }
}
