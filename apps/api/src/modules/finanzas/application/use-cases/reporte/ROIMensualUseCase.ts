import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';

export interface ROIMensualInput {
  salonId: number;
  mes: Date; // any date within the target month
}

export interface ROIMensualOutput {
  ingresos: number;
  gastosFijos: number;
  gastosOperativos: number;
  nomina: number;
  gananciaNeta: number;
}

@injectable()
export class ROIMensualUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
  ) {}

  async execute(input: ROIMensualInput): Promise<ROIMensualOutput> {
    const año = input.mes.getFullYear();
    const mes = input.mes.getMonth(); // 0-indexed

    const inicio = new Date(año, mes, 1, 0, 0, 0, 0);
    const fin = new Date(año, mes + 1, 0, 23, 59, 59, 999);

    // ── Ingresos: sum of servicios + productos of all registros in month ──
    const registros = await this.registroRepo.findBySalonAndDateRange(
      input.salonId,
      inicio,
      fin,
    );
    const ingresos = registros.reduce(
      (sum, r) => sum + Number(r.totalServicios) + Number(r.totalProductos),
      0,
    );

    // ── Gastos: filter by month in-memory ──
    const todosGastos = await this.gastoRepo.findBySalon(input.salonId);
    const gastosDelMes = todosGastos.filter((g) => {
      const gFecha = new Date(g.fecha);
      return gFecha >= inicio && gFecha <= fin;
    });

    const gastosFijos = gastosDelMes
      .filter((g) => g.esGastoFijo)
      .reduce((sum, g) => sum + Number(g.monto), 0);

    const gastosOperativos = gastosDelMes
      .filter((g) => !g.esGastoFijo)
      .reduce((sum, g) => sum + Number(g.monto), 0);

    // ── Nómina: sum totalPagado of liquidaciones in month ──
    const todasLiquidaciones = await this.liquidacionRepo.findBySalon(input.salonId);
    const liquidacionesDelMes = todasLiquidaciones.filter((l) => {
      const lCreado = new Date(l.creadoEn);
      return lCreado >= inicio && lCreado <= fin;
    });
    const nomina = liquidacionesDelMes.reduce(
      (sum, l) => sum + Number(l.totalPagado),
      0,
    );

    const gananciaNeta = ingresos - gastosFijos - gastosOperativos - nomina;

    return {
      ingresos,
      gastosFijos,
      gastosOperativos,
      nomina,
      gananciaNeta,
    };
  }
}
