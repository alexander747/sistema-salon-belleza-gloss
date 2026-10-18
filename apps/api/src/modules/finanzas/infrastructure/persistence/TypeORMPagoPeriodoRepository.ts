import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { PagoTransaccionEntity } from '../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import { EstadoRegistro } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type { PagoPeriodoDTO } from '../../application/dtos/PagoPeriodoDTO';

/** Period selection. `desde`/`hasta` are inclusive Colombia business dates. */
export interface PagoPeriodoQuery {
  salonId: number;
  desde: string;
  hasta: string;
  usuarioId?: number;
  clienteId?: number;
}

/**
 * Payment business date as a pure Colombia date string (YYYY-MM-DD): the caja
 * where the money was received, with the legacy fallback used by
 * `sumPagosPorPeriodo` (registro `fechaHora`, then `creadoEn`) so both always
 * select the same payment set.
 */
const FECHA_NEGOCIO_PAGO_SQL =
  "COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d'))";

interface PagoPeriodoRaw {
  pagoId: number | string;
  fechaCobro: string;
  registroId: number | string;
  clienteId: number | string | null;
  usuarioId: number | string | null;
  cliente: string | null;
  empleada: string | null;
  metodoPago: string;
  monto: string | number;
}

/**
 * Read model for the Excel "Cobros del período" sheet: every payment received
 * in the period (payment business date), across sales of any date — including
 * fiado collected later. Mirrors `sumPagosPorPeriodo`: excludes ANULADO sales
 * and honors the same employee/client filters, so the sheet total reconciles
 * with the P&L "Cobrado" line.
 */
@injectable()
export class TypeORMPagoPeriodoRepository {
  async findBySalonAndPeriodo(params: PagoPeriodoQuery): Promise<PagoPeriodoDTO[]> {
    const query = AppDataSource.getRepository(PagoTransaccionEntity)
      .createQueryBuilder('p')
      .innerJoin('p.registroServicio', 'r')
      .leftJoin('p.caja', 'pc')
      .leftJoin('r.cliente', 'c')
      .leftJoin('r.usuario', 'u')
      .select('p.id', 'pagoId')
      .addSelect(FECHA_NEGOCIO_PAGO_SQL, 'fechaCobro')
      .addSelect('r.id', 'registroId')
      .addSelect('r.clienteId', 'clienteId')
      .addSelect('r.usuarioId', 'usuarioId')
      .addSelect('c.nombre', 'cliente')
      .addSelect('u.nombre', 'empleada')
      .addSelect('p.metodoPago', 'metodoPago')
      .addSelect('p.monto', 'monto')
      .where('r.salonId = :salonId', { salonId: params.salonId })
      .andWhere('r.estado != :anulado', { anulado: EstadoRegistro.ANULADO })
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} >= :desde`, { desde: params.desde })
      .andWhere(`${FECHA_NEGOCIO_PAGO_SQL} <= :hasta`, { hasta: params.hasta });

    if (params.usuarioId !== undefined) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId: params.usuarioId });
    }
    if (params.clienteId !== undefined) {
      query.andWhere('r.clienteId = :clienteId', { clienteId: params.clienteId });
    }

    const rows = await query
      .orderBy('fechaCobro', 'ASC')
      .addOrderBy('pagoId', 'ASC')
      .getRawMany<PagoPeriodoRaw>();

    return rows.map((row) => ({
      pagoId: Number(row.pagoId),
      fechaCobro: row.fechaCobro,
      registroId: Number(row.registroId),
      cliente:
        row.cliente ??
        (row.clienteId != null ? `Cliente #${Number(row.clienteId)}` : 'Cliente'),
      empleada:
        row.empleada ??
        (row.usuarioId != null ? `Empleada #${Number(row.usuarioId)}` : 'Empleada'),
      metodoPago: row.metodoPago,
      monto: Number(row.monto ?? 0),
    }));
  }
}
