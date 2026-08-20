import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import { NotFoundError } from '../../../../../shared/errors';
import { calcularReporteCierre, type MetodoPagoCaja, type ReporteCierre } from './calcularReporteCierre';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

export interface ObtenerDetalleCierreCajaInput {
  salonId: number;
  cajaId: number;
}

export interface DetalleCierreMovimiento {
  id: number;
  tipo: 'SERVICIO' | 'GASTO';
  fecha: Date;
  descripcion: string;
  monto: number;
  metodoPago: MetodoPagoCaja | null;
}

export interface ObtenerDetalleCierreCajaResult {
  caja: CajaDTO;
  reporte: ReporteCierre;
  movimientos: DetalleCierreMovimiento[];
}

/**
 * Detalle read-only de un cierre de caja (historial): recomputa el arqueo
 * desde registros/gastos + montos persistidos y arma la lista de movimientos.
 */
@injectable()
export class ObtenerDetalleCierreCajaUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
  ) {}

  async execute(input: ObtenerDetalleCierreCajaInput): Promise<ObtenerDetalleCierreCajaResult> {
    const caja = await this.cajaRepo.findById(input.cajaId);

    if (!caja || caja.salonId !== input.salonId) {
      throw new NotFoundError('Caja no encontrada');
    }

    const [registros, gastos] = await Promise.all([
      this.registroRepo.search({ salonId: input.salonId, cajaId: caja.id }),
      this.gastoRepo.findByCajaId(caja.id),
    ]);

    // Caja ABIERTA → montoRealEfectivo null (aún no hay arqueo): pasar null en vez
    // de Number(null)=0 para no fabricar un arqueo falso (mismo patrón que el preview).
    const montoRealEfectivo = caja.montoRealEfectivo === null ? null : Number(caja.montoRealEfectivo);

    const reporte = calcularReporteCierre(
      registros,
      gastos,
      montoRealEfectivo,
      Number(caja.montoInicial),
    );

    // Movimientos: registros ACTIVOS como SERVICIO + gastos como GASTO.
    // Se excluyen ANULADOS para que movimientos.length === reporte.cantidadMovimientos.
    const movimientos: DetalleCierreMovimiento[] = [
      ...registros
        .filter((r) => r.estado !== EstadoRegistro.ANULADO)
        .map((r) => ({
          id: r.id,
          tipo: 'SERVICIO' as const,
          fecha: r.creadoEn,
          descripcion:
            r.serviciosItems?.map((si) => si.nombreServicio).join(', ') || `Registro #${r.id}`,
          monto: Number(r.montoTotal),
          metodoPago: (r.pagos?.[0]?.metodoPago as MetodoPagoCaja) ?? null,
        })),
      ...gastos.map((g) => ({
        id: g.id,
        tipo: 'GASTO' as const,
        fecha: g.fecha,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        metodoPago: (g.metodoPago as MetodoPagoCaja) ?? null,
      })),
    ];

    return { caja: cajaToDTO(caja), reporte, movimientos };
  }
}
