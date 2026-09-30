import { injectable } from 'tsyringe';
import type { QueryRunner, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { getColombiaDateString } from '../../../../shared/colombia-date';
import { RegistroServicioEntity, EstadoRegistro } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type {
  IRegistroServicioRepository,
  EstadoRegistroFilter,
  TipoRegistroFilter,
} from '../../domain/ports/IRegistroServicioRepository';

/** Criterios compartidos por `search` y `count` para que el total paginado y las
 *  filas servidas deriven SIEMPRE del mismo WHERE (fix de paginación PR5). */
interface RegistroListFilters {
  salonId: number;
  desde?: Date;
  hasta?: Date;
  usuarioId?: number;
  clienteId?: number;
  cajaId?: number;
  estado?: EstadoRegistroFilter;
  tipo?: TipoRegistroFilter;
}

/** Fecha Colombia pura (YYYY-MM-DD) de un Date de rango (borde 05:00 UTC). */
function fechaColombiaStr(d: Date): string {
  return getColombiaDateString(d);
}

/**
 * Fecha de negocio del pago como string YYYY-MM-DD: la de su CAJA
 * (p.cajaId → caja.fechaCaja, DATE puro); legacy sin caja cae al registro
 * (COALESCE fechaHora, creadoEn). Se compara como fecha Colombia pura para
 * evitar el desfase de las 05:00 UTC.
 */
const FECHA_NEGOCIO_PAGO_SQL =
  "COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d'))";

/** Fecha de negocio del REGISTRO como string YYYY-MM-DD (COALESCE fechaHora,
 *  creadoEn) — usada para detectar si la venta original es previa al período. */
const FECHA_NEGOCIO_REGISTRO_SQL =
  "DATE_FORMAT(COALESCE(r.fechaHora, r.creadoEn), '%Y-%m-%d')";

@injectable()
export class TypeORMRegistroServicioRepository implements IRegistroServicioRepository {
  private getRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(RegistroServicioEntity);
    }
    return AppDataSource.getRepository(RegistroServicioEntity);
  }

  /**
   * ÚNICA fuente de criterios para el listado de registros: `search` y `count`
   * llaman a este método con los mismos params, de modo que `meta.total` no puede
   * divergir de las filas (causa raíz del bug de paginación: antes ninguno filtraba
   * por estado/tipo y el frontend filtraba client-side).
   *
   * `estado`/`tipo` ausentes o `TODOS` ⇒ sin cláusula (compatibilidad con llamadores
   * que no envían los params).
   */
  private aplicarFiltrosRegistro(
    query: SelectQueryBuilder<RegistroServicioEntity>,
    params: RegistroListFilters,
  ): void {
    query.where('r.salonId = :salonId', { salonId: params.salonId });

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

    // Estado: ACTIVOS excluye ANULADO; ANULADOS lo selecciona; TODOS/ausente no filtra.
    if (params.estado === 'ACTIVOS') {
      query.andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO });
    } else if (params.estado === 'ANULADOS') {
      query.andWhere('r.estado = :anulado', { anulado: EstadoRegistro.ANULADO });
    }

    // Tipo: la fila pertenece al grupo si tiene monto en esa categoría.
    if (params.tipo === 'SERVICIOS') {
      query.andWhere('r.totalServicios > 0');
    } else if (params.tipo === 'PRODUCTOS') {
      query.andWhere('r.totalProductos > 0');
    }
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
      // `serviciosItems` es necesario para la nómina: suma
      // `serviciosItems[].costoBaseInsumos` del período. Sin la relación el total
      // es siempre 0 (regresión B-1). Único consumidor: NominaPendienteUseCase.
      relations: ['pagos', 'divisiones', 'serviciosItems'],
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
    estado?: EstadoRegistroFilter;
    tipo?: TipoRegistroFilter;
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
      .leftJoinAndSelect('r.caja', 'rcaja');

    this.aplicarFiltrosRegistro(query, params);

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
    estado?: EstadoRegistroFilter;
    tipo?: TipoRegistroFilter;
  }): Promise<number> {
    const query = this.getRepo().createQueryBuilder('r');
    this.aplicarFiltrosRegistro(query, params);
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
      .leftJoin('p.caja', 'pc')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      // La fecha de negocio del pago es la de su CAJA (pago.cajaId → caja.fechaCaja,
      // DATE puro sin hora); p.creadoEn es el momento de carga (backfill: hoy ≠ fecha
      // real). Legacy sin caja cae al registro (COALESCE fechaHora, creadoEn).
      // El rango se convierte a fecha Colombia pura (YYYY-MM-DD) para comparar con
      // el DATE de la caja sin el desfase de las 05:00 UTC.
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} >= :fechaInicioStr`, {
        fechaInicioStr: fechaColombiaStr(fechaInicio),
      })
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} < :fechaFinStr`, {
        fechaFinStr: fechaColombiaStr(fechaFin),
      });

    if (usuarioId !== undefined) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId });
    }
    if (clienteId !== undefined) {
      query.andWhere('r.clienteId = :clienteId', { clienteId });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }

  /**
   * Cobros de DEUDA ANTERIOR: Σ pagos recibidos en el período (misma fecha de
   * negocio del pago que `sumPagosPorPeriodo`) cuya venta original — fecha de
   * negocio del REGISTRO (COALESCE fechaHora, creadoEn) — es ANTERIOR al inicio
   * del período. Excluye ANULADO y respeta `usuarioId`/`clienteId`, igual que
   * `sumPagosPorPeriodo`; los pagos sobre registros del propio período no cuentan.
   */
  async sumCobrosDeudaAnterior(
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
      .leftJoin('p.caja', 'pc')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      // Ventana del PAGO: [inicio, fin) como fecha Colombia pura (evita 05:00 UTC).
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} >= :fechaInicioStr`, {
        fechaInicioStr: fechaColombiaStr(fechaInicio),
      })
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} < :fechaFinStr`, {
        fechaFinStr: fechaColombiaStr(fechaFin),
      })
      // La VENTA original es anterior al período (sin la caja del pago).
      .andWhere(`${FECHA_NEGOCIO_REGISTRO_SQL} < :fechaRegistroAnteriorStr`, {
        fechaRegistroAnteriorStr: fechaColombiaStr(fechaInicio),
      });

    if (usuarioId !== undefined) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId });
    }
    if (clienteId !== undefined) {
      query.andWhere('r.clienteId = :clienteId', { clienteId });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }

  /**
   * Cobrado por mes (cash): igual que sumPagosPorPeriodo pero agrupando por
   * mes (YYYY-MM) de la fecha de negocio del pago (COALESCE caja del pago,
   * fechaHora, creadoEn del registro). Devuelve solo los meses con pagos.
   */
  async sumPagosPorMes(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<Array<{ mes: string; total: number }>> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .select(`SUBSTRING(${FECHA_NEGOCIO_PAGO_SQL}, 1, 7)`, 'mes')
      .addSelect('COALESCE(SUM(p.monto), 0)', 'total')
      .innerJoin('r.pagos', 'p')
      .leftJoin('p.caja', 'pc')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} >= :fechaInicioStr`, {
        fechaInicioStr: fechaColombiaStr(fechaInicio),
      })
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} < :fechaFinStr`, {
        fechaFinStr: fechaColombiaStr(fechaFin),
      })
      .groupBy(`SUBSTRING(${FECHA_NEGOCIO_PAGO_SQL}, 1, 7)`)
      .orderBy('mes', 'ASC');

    const rows = await query.getRawMany<{ mes: string; total: string }>();
    return rows.map((row) => ({ mes: row.mes, total: Number(row.total ?? 0) }));
  }

  /** Fiado originado en el período: Σ montoPendiente de registros NO ANULADO del
   *  salón cuya fecha de negocio (COALESCE(fechaHora, creadoEn)) cae en el rango. */
  async sumMontoPendientePorPeriodo(    salonId: number,
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
