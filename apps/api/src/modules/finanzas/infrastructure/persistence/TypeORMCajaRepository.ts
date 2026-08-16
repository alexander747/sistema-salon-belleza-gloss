import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { CajaEntity } from '../../../../infrastructure/persistence/entities/CajaEntity';
import type { ICajaRepository, CerrarCajaData } from '../../domain/ports/ICajaRepository';
import type { EstadoCaja } from '../../../../infrastructure/persistence/entities/CajaEntity';

@injectable()
export class TypeORMCajaRepository implements ICajaRepository {
  private getRepo() {
    return AppDataSource.getRepository(CajaEntity);
  }

  async findBySalonYFecha(salonId: number, fechaCaja: string): Promise<CajaEntity | null> {
    return this.getRepo().findOne({ where: { salonId, fechaCaja } });
  }

  async findAbiertaBySalonYFecha(salonId: number, fechaCaja: string): Promise<CajaEntity | null> {
    return this.getRepo().findOne({ where: { salonId, fechaCaja, estado: 'ABIERTA' } });
  }

  async create(data: Partial<CajaEntity>): Promise<CajaEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  /**
   * UPDATE condicional: solo cierra si la caja sigue ABIERTA.
   * `result.affected === 1` → ganó el cierre; `0` → otra request ya la cerró (race).
   */
  async cerrar(id: number, data: CerrarCajaData): Promise<boolean> {
    const result = await this.getRepo()
      .createQueryBuilder()
      .update(CajaEntity)
      .set({
        estado: 'CERRADA',
        montoEsperado: data.montoEsperado,
        montoRealEfectivo: data.montoRealEfectivo,
        diferencia: data.diferencia,
        cierrePorId: data.cierrePorId ?? null,
        cierreEn: new Date(),
      })
      .where('id = :id AND estado = :estado', { id, estado: 'ABIERTA' })
      .execute();

    return result.affected === 1;
  }

  /**
   * UPDATE condicional: reabre solo si la caja sigue CERRADA.
   * Limpia los datos del cierre intermedio (el cierre final de fin de día los reemplaza).
   * `result.affected === 1` → ganó la reapertura; `0` → otra request ya la reabrió (race).
   */
  async reabrir(id: number): Promise<boolean> {
    const result = await this.getRepo()
      .createQueryBuilder()
      .update(CajaEntity)
      .set({
        estado: 'ABIERTA',
        montoEsperado: null,
        montoRealEfectivo: null,
        diferencia: null,
        cierrePorId: null,
        cierreEn: null,
      })
      .where('id = :id AND estado = :estado', { id, estado: 'CERRADA' })
      .execute();

    return result.affected === 1;
  }

  async listBySalonPaginated(
    salonId: number,
    page: number,
    limit: number,
    estado?: EstadoCaja,
  ): Promise<{ data: CajaEntity[]; total: number }> {
    const query = this.getRepo()
      .createQueryBuilder('c')
      .where('c.salonId = :salonId', { salonId });

    if (estado) {
      query.andWhere('c.estado = :estado', { estado });
    }

    const total = await query.getCount();

    const skip = limit > 0 ? (page - 1) * limit : undefined;
    if (skip !== undefined) query.skip(skip);
    if (limit > 0) query.take(limit);

    const data = await query.orderBy('c.fechaCaja', 'DESC').getMany();

    return { data, total };
  }
}
