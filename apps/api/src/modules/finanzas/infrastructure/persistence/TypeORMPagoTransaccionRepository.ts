import { injectable } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { PagoTransaccionEntity } from '../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import { EstadoRegistro } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type { IPagoTransaccionRepository } from '../../domain/ports/IPagoTransaccionRepository';

@injectable()
export class TypeORMPagoTransaccionRepository implements IPagoTransaccionRepository {
  private getRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(PagoTransaccionEntity);
    }
    return AppDataSource.getRepository(PagoTransaccionEntity);
  }

  async create(data: Partial<PagoTransaccionEntity>, queryRunner?: QueryRunner): Promise<PagoTransaccionEntity> {
    const repo = this.getRepo(queryRunner);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async findByRegistro(registroServicioId: number): Promise<PagoTransaccionEntity[]> {
    return this.getRepo().find({
      where: { registroServicioId },
    });
  }

  async bulkCreate(data: Partial<PagoTransaccionEntity>[], queryRunner?: QueryRunner): Promise<PagoTransaccionEntity[]> {
    const repo = this.getRepo(queryRunner);
    const entities = repo.create(data);
    return repo.save(entities);
  }

  /**
   * Arqueo: pagos que pertenecen a la caja `cajaId`.
   * Unión sin doble conteo: `p.cajaId = C` (pagos de la caja + abonos de hoy
   * sobre registros de otra caja) OR (`p.cajaId IS NULL` legacy AND el registro
   * es de la caja C y NO está anulado — preserva la exclusión de ANULADOS del
   * arqueo actual).
   */
  async findByCajaConFallback(cajaId: number): Promise<PagoTransaccionEntity[]> {
    return this.getRepo()
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.registroServicio', 'registro')
      .where('pago.cajaId = :cajaId', { cajaId })
      .orWhere(
        'pago.cajaId IS NULL AND registro.cajaId = :cajaId AND registro.estado != :anulado',
        { cajaId, anulado: EstadoRegistro.ANULADO },
      )
      .getMany();
  }
}
