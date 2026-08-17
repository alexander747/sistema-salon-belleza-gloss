import { injectable, inject } from 'tsyringe';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';
import type { CuentaPagarDTO } from '../../dtos/CuentasDTO';
import { NominaPendienteUseCase } from '../liquidacion/NominaPendienteUseCase';
import { HistorialLiquidacionesUseCase } from '../liquidacion/HistorialLiquidacionesUseCase';

export interface CuentasPagarInput extends PaginationParams {
  salonId: number;
}

/**
 * Cuentas por pagar: obligaciones del salón con empleadas, compuestas desde
 * los use cases existentes (cero duplicación de lógica):
 *   - `NominaPendienteUseCase` → pendienteActual (totalAPagar).
 *   - `HistorialLiquidacionesUseCase` → liquidadoAcumulado (suma de totalPagado).
 *   - `IUsuarioRepository.findBySalon` → nombre/sueldoFijo/comisión actuales.
 *
 * FRONTERA DE MES: se preserva la semántica de `NominaPendienteUseCase` (solo
 * registros posteriores a la última liquidación del período en curso). Una
 * empleada liquidada este mes sin registros nuevos aparece con
 * `pendienteActual=0`; NO se corrige cross-period (decisión documentada del
 * owner — ver proposal `cuentas-pagar-cobrar`).
 */
@injectable()
export class CuentasPagarUseCase {
  constructor(
    @inject(NominaPendienteUseCase)
    private readonly nominaUseCase: NominaPendienteUseCase,
    @inject(HistorialLiquidacionesUseCase)
    private readonly historialUseCase: HistorialLiquidacionesUseCase,
    @inject('IPersonasUsuarioRepository')
    private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(input: CuentasPagarInput): Promise<PaginatedResult<CuentaPagarDTO>> {
    const [nomina, historial, usuarios] = await Promise.all([
      this.nominaUseCase.execute({ salonId: input.salonId }),
      this.historialUseCase.execute({ salonId: input.salonId }),
      this.usuarioRepo.findBySalon(input.salonId),
    ]);

    const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
    const nominaPorEmpleada = new Map(nomina.map((n) => [n.empleadaId, n]));

    const acumuladoPorEmpleada = new Map<number, number>();
    for (const liquidacion of historial) {
      acumuladoPorEmpleada.set(
        liquidacion.usuarioId,
        (acumuladoPorEmpleada.get(liquidacion.usuarioId) ?? 0) + Number(liquidacion.totalPagado),
      );
    }

    // Unión de ambas fuentes: empleadas presentes solo en una SHALL aparecer.
    const empleadaIds = new Set<number>([
      ...nominaPorEmpleada.keys(),
      ...acumuladoPorEmpleada.keys(),
    ]);

    const filas: CuentaPagarDTO[] = [...empleadaIds].map((empleadaId) => {
      const usuario = usuarioPorId.get(empleadaId);
      const nominaEntry = nominaPorEmpleada.get(empleadaId);
      const pendienteActual = nominaEntry?.totalAPagar ?? 0;
      const liquidadoAcumulado = acumuladoPorEmpleada.get(empleadaId) ?? 0;
      return {
        empleadaId,
        nombre: usuario?.nombre ?? nominaEntry?.nombre ?? '',
        sueldoFijo: usuario ? Number(usuario.sueldoFijo) : (nominaEntry?.sueldoFijo ?? 0),
        porcentajeComisionServicio: usuario
          ? Number(usuario.porcentajeComisionServicio)
          : (nominaEntry?.porcentajeComisionServicio ?? 0),
        pendienteActual,
        liquidadoAcumulado,
        // "Al día" = sin deuda pendiente Y con historial liquidado (frontera de
        // mes de la nómina: liquidada sin registros nuevos aparece aquí).
        alDia: pendienteActual === 0 && liquidadoAcumulado > 0,
      };
    });

    filas.sort((a, b) => a.empleadaId - b.empleadaId);

    const total = filas.length;
    const data = input.limit > 0 ? filas.slice((input.page - 1) * input.limit, input.page * input.limit) : filas;
    return paginate(data, total, { page: input.page, limit: input.limit });
  }
}
