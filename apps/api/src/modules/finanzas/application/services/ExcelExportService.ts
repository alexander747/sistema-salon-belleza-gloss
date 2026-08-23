import { injectable, inject } from 'tsyringe';
import ExcelJS from 'exceljs';
import { PyLMensualUseCase, type PyLMensualInput, type PyLMensualOutput } from '../use-cases/reporte/PyLMensualUseCase';
import type { IRegistroServicioRepository } from '../../domain/ports/IRegistroServicioRepository';
import { colombiaDayStartUTC, colombiaDayEndUTC, getColombiaDateString } from '../../../../shared/colombia-date';
import { calcularContribucionesRegistro } from '../use-cases/reporte/calculo-registro';
import type { RegistroServicioEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import { EstadoRegistro } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';

/** Fila de detalle para la hoja "Movimientos" del workbook exportado. */
export interface RegistroMovimiento {
  fecha: string; // YYYY-MM-DD (fecha Colombia)
  cliente: string;
  empleada: string;
  servicios: number; // contribución post-descuento (consistente con el P&L)
  productos: number;
  propina: number;
  comision: number;
  valorFinal: number;
  /** Deuda pendiente del registro (fiado por cobrar). */
  pendiente: number;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4F46E5' },
};

const COP_FORMAT = '$#,##0';

const PYL_HEADER = ['Concepto', 'Valor'];
const MOVIMIENTOS_HEADER = ['Fecha', 'Cliente', 'Empleada', 'Servicios', 'Productos', 'Propina', 'Comisión', 'Valor final', 'Pendiente'];

/** Convierte un registro en una fila de movimientos usando la misma
 *  contribución post-descuento que el P&L (misma fuente de verdad). */
export function registroAMovimiento(registro: RegistroServicioEntity): RegistroMovimiento {
  const servBruto = Number(registro.totalServicios);
  const prodBruto = Number(registro.totalProductos);
  const propina = Number(registro.propina);
  const montoTotal = Number(registro.montoTotal);

  const { servicios, productos } = calcularContribucionesRegistro({
    totalServicios: servBruto,
    totalProductos: prodBruto,
    propina,
    montoTotal,
    valorFinal: registro.valorFinal != null ? Number(registro.valorFinal) : montoTotal,
  });

  // Fecha Colombia del creadoEn (UTC → 05:00 UTC = 00:00 COT)
  const fecha = getColombiaDateString(registro.creadoEn);

  return {
    fecha,
    cliente: registro.cliente?.nombre ?? `Cliente #${registro.clienteId}`,
    empleada: registro.usuario?.nombre ?? `Empleada #${registro.usuarioId}`,
    servicios,
    productos,
    propina,
    comision: Number(registro.comisionCalculada),
    valorFinal: registro.valorFinal != null ? Number(registro.valorFinal) : montoTotal,
    pendiente: Number(registro.montoPendiente ?? 0),
  };
}

function estiloHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = HEADER_FILL;
  cell.alignment = { vertical: 'middle' };
}

@injectable()
export class ExcelExportService {
  constructor(
    @inject(PyLMensualUseCase)
    private readonly pylMensualUseCase: PyLMensualUseCase,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  /**
   * Orquesta el P&L y los movimientos del período y devuelve el workbook listo.
   * Puro (sin I/O): los tests pueden inspeccionar las hojas directamente.
   */
  buildPyLWorkbook(pyl: PyLMensualOutput, movimientos: RegistroMovimiento[]): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const pylSheet = workbook.addWorksheet('P&L');
    const movSheet = workbook.addWorksheet('Movimientos');

    // ── Hoja P&L: resumen por concepto ──
    pylSheet.columns = [{ width: 34 }, { width: 18 }];
    const pylHeader = pylSheet.addRow(PYL_HEADER);
    pylHeader.eachCell((cell) => estiloHeader(cell));
    pylSheet.getRow(1).height = 20;

    const conceptos: Array<[string, string | number]> = [
      ['Período', `${pyl.desde} a ${pyl.hasta}`],
      ['Ingresos brutos', pyl.ingresosBrutos],
      ['Descuentos', pyl.descuentos],
      ['Ingresos netos', pyl.ingresosNetos],
      ['Total servicios', pyl.totalServicios],
      ['Total productos', pyl.totalProductos],
      ['Propinas', pyl.propinas],
      ['Cobrado', pyl.cobrado],
      ['Fiado del período', pyl.fiadoPeriodo],
      ['Deudas por cobrar', pyl.deudasPorCobrar],
      ['Insumos (costo base)', pyl.costoBaseInsumos],
      ['Margen bruto', pyl.margenBruto],
      ['Comisiones', pyl.comisiones],
      ['Gastos fijos', pyl.gastosFijos],
      ['Gastos operativos', pyl.gastosOperativos],
    ];
    // Una fila por categoría de gasto, si existe
    for (const [categoria, monto] of Object.entries(pyl.gastosPorCategoria ?? {})) {
      conceptos.push([`Gastos por categoría — ${categoria}`, monto]);
    }
    conceptos.push(['Total gastos', pyl.totalGastos]);
    conceptos.push(['Devoluciones', pyl.devoluciones]);
    conceptos.push(['Utilidad neta', pyl.utilidadNeta]);

    for (const [concepto, valor] of conceptos) {
      const row = pylSheet.addRow([concepto, valor]);
      // Formato COP solo para filas numéricas (el período es texto)
      if (typeof valor === 'number') {
        row.getCell(2).numFmt = COP_FORMAT;
      }
      if (concepto === 'Utilidad neta') {
        row.font = { bold: true };
      }
    }

    // ── Hoja Movimientos: detalle por registro ──
    movSheet.columns = [{ width: 12 }, { width: 24 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
    const movHeader = movSheet.addRow(MOVIMIENTOS_HEADER);
    movHeader.eachCell((cell) => estiloHeader(cell));
    movSheet.getRow(1).height = 20;

    for (const m of movimientos) {
      const row = movSheet.addRow([m.fecha, m.cliente, m.empleada, m.servicios, m.productos, m.propina, m.comision, m.valorFinal, m.pendiente]);
      for (const col of [4, 5, 6, 7, 8, 9]) {
        row.getCell(col).numFmt = COP_FORMAT;
      }
    }

    return workbook;
  }

  /** Ejecuta el P&L + movimientos del período y serializa el workbook a Buffer. */
  async exportar(input: PyLMensualInput & { salonId: number }): Promise<{ buffer: Buffer; filename: string }> {
    const hoy = getColombiaDateString();
    const desde = input.desde ?? `${hoy.slice(0, 7)}-01`;
    const hasta = input.hasta ?? hoy;

    const inicio = colombiaDayStartUTC(desde);
    const fin = colombiaDayEndUTC(hasta);

    const [pyl, registros] = await Promise.all([
      this.pylMensualUseCase.execute({
        salonId: input.salonId,
        desde,
        hasta,
        ...(input.usuarioId !== undefined ? { usuarioId: input.usuarioId } : {}),
      }),
      this.registroRepo.search({
        salonId: input.salonId,
        desde: inicio,
        hasta: fin,
        ...(input.usuarioId !== undefined ? { usuarioId: input.usuarioId } : {}),
      }),
    ]);

    const movimientos = registros
      .filter((r) => r.estado !== EstadoRegistro.ANULADO)
      .map(registroAMovimiento);

    const workbook = this.buildPyLWorkbook(pyl, movimientos);
    // exceljs devuelve su propio tipo Buffer (extends ArrayBuffer); convertirlo
    // al Buffer de Node para que Express pueda enviarlo como binario.
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `pyl_${desde}_${hasta}.xlsx`;

    return { buffer, filename };
  }
}
