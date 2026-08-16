import type { CajaDTO } from './CajaDTO';
import type { ReporteCierre } from '../use-cases/caja/calcularReporteCierre';

export interface ReporteCierreDTO {
  /** Caja marcada CERRADA con los montos del arqueo persistidos. */
  caja: CajaDTO;
  /** Reporte de cierre (desglose por método de pago, esperado vs real). */
  reporte: ReporteCierre;
}
