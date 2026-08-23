import { injectable } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { RegistroServicioEntity, EstadoRegistro } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type { IRegistroServicioRepository } from '../../domain/ports/IRegistroServicioRepository';

@injectable()
export class TypeORMRegistroServicioRepository implements IRegistroServicioRepository {
  private getRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(RegistroServicioEntity);
    }
    return AppDataSource.getRepository(RegistroServicioEntity);
  }

  async create(data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity> {
    const repo = this.getRepo(queryRunner);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async findById(id: number): Promise<RegistroServicioEntity | null> {
    return this.getRepo()
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.pagos', 'pago')
      .leftJoinAndSelect('r.divisiones', 'division')
      .leftJoinAndSelect('r.devoluciones', 'devolucion')
      .leftJoinAndSelect('r.cliente', 'cliente')
      .leftJoinAndSelect('r.usuario', 'usuario')
      .leftJoinAndSelect('r.productosVendidos', 'rp')
      .leftJoinAndSelect('rp.producto', 'p')
      .leftJoinAndSelect('r.serviciosItems', 'si')
      .where('r.id = :id', { id })
      .getOne();
  }

  async findBySalon(salonId: number): Promise<RegistroServicioEntity[]> {
    return this.getRepo().find({
      where: { salonId },
      relations: ['pagos', 'divisiones'],
      order: { creadoEn: 'DESC' },
    });
  }

  async findConDeudaBySalon(salonId: number): Promise<RegistroServicioEntity[]> {
    return this.getRepo()
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.cliente', 'cliente')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.montoPendiente > 0')
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      // Antigüedad de la deuda por fecha de negocio (backfill); legacy -> creadoEn
      .orderBy('COALESCE(r.fechaHora, r.creadoEn)', 'ASC')
      .getMany();
  }

  async findBySalonAndDateRange(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<RegistroServicioEntity[]> {
    return this.getRepo()
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.pagos', 'pago')
      .leftJoinAndSelect('r.divisiones', 'division')
      .leftJoinAndSelect('r.devoluciones', 'devolucion')
      .leftJoinAndSelect('r.serviciosItems', 'si')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('COALESCE(r.fechaHora, r.creadoEn) >= :fechaInicio', { fechaInicio })
      .andWhere('COALESCE(r.fechaHora, r.creadoEn) <= :fechaFin', { fechaFin })
      .orderBy('COALESCE(r.fechaHora, r.creadoEn)', 'DESC')
      .getMany();
  }

  async search(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    cajaId?: number;
    skip?: number;
    take?: number;
  }): Promise<RegistroServicioEntity[]> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.pagos', 'pago')
      .leftJoinAndSelect('r.divisiones', 'division')
      .leftJoinAndSelect('r.cliente', 'cliente')
      .leftJoinAndSelect('r.usuario', 'usuario')
      .leftJoinAndSelect('r.productosVendidos', 'rp')
      .leftJoinAndSelect('rp.producto', 'p')
      .leftJoinAndSelect('r.serviciosItems', 'si')
      .where('r.salonId = :salonId', { salonId: params.salonId });

    if (params.desde) {
      query.andWhere('COALESCE(r.fechaHora, r.creadoEn) >= :desde', { desde: params.desde });
    }
    if (params.hasta) {
      query.andWhere('COALESCE(r.fechaHora, r.creadoEn) <= :hasta', { hasta: params.hasta });
    }
    if (params.usuarioId) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId: params.usuarioId });
    }
    if (params.clienteId) {
      query.andWhere('r.clienteId = :clienteId', { clienteId: params.clienteId });
    }
    if (params.cajaId) {
      query.andWhere('r.cajaId = :cajaId', { cajaId: params.cajaId });
    }

    if (params.skip !== undefined) query.skip(params.skip);
    if (params.take !== undefined && params.take > 0) query.take(params.take);

    // TypeORM no acepta funciones SQL en orderBy cuando hay paginación (parsea
    // "COALESCE(r" como alias inexistente al combinar ORDER BY con la subquery).
    // Se agrega la expresión como columna virtual con alias y se ordena por ella.
    return query
      .addSelect('COALESCE(r.fechaHora, r.creadoEn)', 'r_fechaHoraOrden')
      .orderBy('r_fechaHoraOrden', 'DESC')
      .getMany();
  }

  async count(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    cajaId?: number;
  }): Promise<number> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .where('r.salonId = :salonId', { salonId: params.salonId });

    if (params.desde) {
      query.andWhere('COALESCE(r.fechaHora, r.creadoEn) >= :desde', { desde: params.desde });
    }
    if (params.hasta) {
      query.andWhere('COALESCE(r.fechaHora, r.creadoEn) <= :hasta', { hasta: params.hasta });
    }
    if (params.usuarioId) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId: params.usuarioId });
    }
    if (params.clienteId) {
      query.andWhere('r.clienteId = :clienteId', { clienteId: params.clienteId });
    }
    if (params.cajaId) {
      query.andWhere('r.cajaId = :cajaId', { cajaId: params.cajaId });
    }

    return query.getCount();
  }

  async update(id: number, data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity | null> {
    const repo = this.getRepo(queryRunner);
    await repo.update(id, data);
    if (queryRunner) {
      return queryRunner.manager.findOne(RegistroServicioEntity, { where: { id } });
    }
    return this.findById(id);
  }

  /**
   * Cobrado cash del período: Σ pagos por fecha de RECEPCIÓN del dinero
   * (pago.creadoEn — para pagos de venta ≈ fechaHora; para abonos es el momento
   * del abono), unido a registros NO ANULADO del salón. `usuarioId` filtra la
   * suma a los pagos de una empleada (consistente con el filtro del P&L).
   */
  async sumPagosPorPeriodo(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
    usuarioId?: number,
    clienteId?: number,
  ): Promise<number> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .select('COALESCE(SUM(p.monto), 0)', 'total')
      .innerJoin('r.pagos', 'p')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      .andWhere('p.creadoEn >= :fechaInicio', { fechaInicio })
      .andWhere('p.creadoEn < :fechaFin', { fechaFin });

    if (usuarioId !== undefined) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId });
    }
    if (clienteId !== undefined) {
      query.andWhere('r.clienteId = :clienteId', { clienteId });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }

  /** Fiado originado en el período: Σ montoPendiente de registros NO ANULADO del
   *  salón cuya fecha de negocio (COALESCE(fechaHora, creadoEn)) cae en el rango. */
  async sumMontoPendientePorPeriodo(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
    usuarioId?: number,
    clienteId?: number,
  ): Promise<number> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.montoPendiente), 0)', 'total')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      .andWhere('COALESCE(r.fechaHora, r.creadoEn) >= :fechaInicio', { fechaInicio })
      .andWhere('COALESCE(r.fechaHora, r.creadoEn) < :fechaFin', { fechaFin });

    if (usuarioId !== undefined) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId });
    }
    if (clienteId !== undefined) {
      query.andWhere('r.clienteId = :clienteId', { clienteId });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }

  /** Deudas por cobrar acumuladas (snapshot): Σ montoPendiente de registros
   *  NO ANULADO con fecha de negocio (COALESCE(fechaHora, creadoEn)) ≤ hasta. */
  async sumMontoPendienteHasta(
    salonId: number,
    hasta: Date,
    usuarioId?: number,
    clienteId?: number,
  ): Promise<number> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.montoPendiente), 0)', 'total')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      .andWhere('COALESCE(r.fechaHora, r.creadoEn) <= :hasta', { hasta });

    if (usuarioId !== undefined) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId });
    }
    if (clienteId !== undefined) {
      query.andWhere('r.clienteId = :clienteId', { clienteId });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }
}
