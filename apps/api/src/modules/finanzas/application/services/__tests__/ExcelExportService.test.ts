import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { ExcelExportService, type RegistroMovimiento } from '../ExcelExportService';
import type { PyLMensualOutput } from '../../use-cases/reporte/PyLMensualUseCase';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

const pylData: PyLMensualOutput = {
  desde: '2026-05-01',
  hasta: '2026-05-31',
  cantidadAtenciones: 3,
  ingresosBrutos: 350000,
  descuentos: 35000,
  incrementos: 0,
  ingresosNetos: 315000,
  totalServicios: 270000,
  totalProductos: 45000,
  propinas: 15000,
  cobrado: 330000,
  fiadoPeriodo: 0,
  deudasPorCobrar: 50000,
  costoBaseInsumos: 60000,
  margenBruto: 255000,
  comisiones: 48000,
  gastosFijos: 200000,
  gastosOperativos: 80000,
  gastosPorCategoria: { ARRIENDO: 200000, SERVICIOS_PUBLICOS: 80000 },
  totalGastos: 280000,
  devoluciones: 20000,
  utilidadNeta: -78000,
};

const movimientos: RegistroMovimiento[] = [
  {
    fecha: '2026-05-15',
    cliente: 'María Pérez',
    empleada: 'Ana Gómez',
    servicios: 90000,
    productos: 18000,
    propina: 5000,
    comision: 16000,
    valorFinal: 113000,
    pendiente: 0,
  },
  {
    fecha: '2026-05-20',
    cliente: 'Luis Torres',
    empleada: 'Ana Gómez',
    servicios: 100000,
    productos: 10000,
    propina: 5000,
    comision: 16000,
    valorFinal: 115000,
    pendiente: 20000,
  },
];

const emptyPyl: PyLMensualOutput = {
  desde: '2026-06-01',
  hasta: '2026-06-30',
  cantidadAtenciones: 0,
  ingresosBrutos: 0,
  descuentos: 0,
  incrementos: 0,
  ingresosNetos: 0,
  totalServicios: 0,
  totalProductos: 0,
  propinas: 0,
  cobrado: 0,
  fiadoPeriodo: 0,
  deudasPorCobrar: 0,
  costoBaseInsumos: 0,
  margenBruto: 0,
  comisiones: 0,
  gastosFijos: 0,
  gastosOperativos: 0,
  gastosPorCategoria: {},
  totalGastos: 0,
  devoluciones: 0,
  utilidadNeta: 0,
};

const buildRegistro = (overrides: Partial<Record<string, unknown>> = {}) => ({
  estado: EstadoRegistro.ACTIVO,
  creadoEn: new Date('2026-05-15T15:00:00.000Z'),
  totalServicios: 100000,
  totalProductos: 20000,
  montoTotal: 125000,
  propina: 5000,
  comisionCalculada: 16000,
  valorFinal: 113000,
  montoPendiente: 0,
  clienteId: 1,
  usuarioId: 4,
  cliente: { nombre: 'María Pérez' },
  usuario: { nombre: 'Ana Gómez' },
  serviciosItems: [],
  ...overrides,
});

describe('ExcelExportService.buildPyLWorkbook', () => {
  let service: ExcelExportService;

  beforeEach(() => {
    service = new ExcelExportService({ execute: vi.fn() } as never, {} as never);
  });

  it('crea un workbook con dos hojas: P&L y Movimientos', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['P&L', 'Movimientos']);
  });

  it('la hoja P&L tiene encabezado con estilo bold y fill #4f46e5', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos);
    const sheet = wb.getWorksheet('P&L')!;
    const headerCell = sheet.getCell('A1');
    expect(headerCell.font.bold).toBe(true);
    expect(headerCell.fill).toMatchObject({ fgColor: { argb: 'FF4F46E5' } });
  });

  it('la hoja P&L contiene filas de totales con valores del P&L (utilidad neta)', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const labels = rows.map((r) => r.getCell(1).value);
    expect(labels).toContain('Utilidad neta');
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).value).toBe(-78000);
    const ingresosRow = rows.find((r) => r.getCell(1).value === 'Ingresos brutos')!;
    expect(ingresosRow.getCell(2).value).toBe(350000);
  });

  it('la hoja P&L muestra las líneas cash: Cobrado, Fiado del período y Deudas por cobrar', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;

    const cobradoRow = rows.find((r) => r.getCell(1).value === 'Cobrado')!;
    expect(cobradoRow.getCell(2).value).toBe(330000);
    const fiadoRow = rows.find((r) => r.getCell(1).value === 'Fiado del período')!;
    expect(fiadoRow.getCell(2).value).toBe(0);
    const deudasRow = rows.find((r) => r.getCell(1).value === 'Deudas por cobrar')!;
    expect(deudasRow.getCell(2).value).toBe(50000);
    // Utilidad neta es cash (cobrado − costos) y aparece después de Deudas
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).value).toBe(-78000);
  });

  it('las celdas de dinero usan formato COP $#,##0', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).numFmt).toBe('$#,##0');
  });

  it('define anchos de columna para la hoja P&L', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos);
    const sheet = wb.getWorksheet('P&L')!;
    expect(sheet.getColumn(1).width).toBeGreaterThan(0);
    expect(sheet.getColumn(2).width).toBeGreaterThan(0);
  });

  it('la hoja Movimientos tiene encabezado y filas de detalle', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos);
    const sheet = wb.getWorksheet('Movimientos')!;
    expect(sheet.getCell('A1').value).toBe('Fecha');
    expect(sheet.getCell('B1').value).toBe('Cliente');
    expect(sheet.getCell('C1').value).toBe('Empleada');
    expect(sheet.getCell('D1').value).toBe('Servicios');
    expect(sheet.getCell('H1').value).toBe('Valor final');
    expect(sheet.getCell('I1').value).toBe('Pendiente');
    // 1 header + 2 rows
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getCell('A2').value).toBe('2026-05-15');
    expect(sheet.getCell('B2').value).toBe('María Pérez');
    expect(sheet.getCell('C2').value).toBe('Ana Gómez');
    expect(sheet.getCell('D2').value).toBe(90000);
    expect(sheet.getCell('H2').value).toBe(113000);
    // Columna Pendiente: 0 (pagado) y 20000 (fiado)
    expect(sheet.getCell('I2').value).toBe(0);
    expect(sheet.getCell('I3').value).toBe(20000);
    // Copia el formato COP en las columnas de dinero
    expect(sheet.getCell('D2').numFmt).toBe('$#,##0');
    expect(sheet.getCell('I2').numFmt).toBe('$#,##0');
  });

  it('período vacío: ambas hojas existen con ceros y solo encabezado de movimientos', () => {
    const wb = service.buildPyLWorkbook(emptyPyl, []);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['P&L', 'Movimientos']);
    const pylSheet = wb.getWorksheet('P&L')!;
    const rows = pylSheet.getRows(1, pylSheet.rowCount)!;
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).value).toBe(0);
    const cobradoRow = rows.find((r) => r.getCell(1).value === 'Cobrado')!;
    expect(cobradoRow.getCell(2).value).toBe(0);
    const movSheet = wb.getWorksheet('Movimientos')!;
    expect(movSheet.rowCount).toBe(1); // solo encabezado
  });
});

describe('ExcelExportService.exportar', () => {
  let service: ExcelExportService;
  let mockPylUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockRegistroRepo: { search: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPylUseCase = { execute: vi.fn() };
    mockRegistroRepo = { search: vi.fn() };
    service = new ExcelExportService(mockPylUseCase as never, mockRegistroRepo as never);
  });

  it('orquesta PyLMensualUseCase + registroRepo.search y devuelve buffer xlsx válido', async () => {
    mockPylUseCase.execute.mockResolvedValue(pylData);
    mockRegistroRepo.search.mockResolvedValue([buildRegistro()]);

    const result = await service.exportar({ salonId: 1, desde: '2026-05-01', hasta: '2026-05-31' });

    expect(mockPylUseCase.execute).toHaveBeenCalledWith({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });
    expect(mockRegistroRepo.search).toHaveBeenCalledWith({
      salonId: 1,
      desde: expect.any(Date),
      hasta: expect.any(Date),
    });
    // XLSX magic bytes: PK\x03\x04
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');
    // Filename pyl_<desde>_<hasta>.xlsx
    expect(result.filename).toBe('pyl_2026-05-01_2026-05-31.xlsx');

    // El buffer puede releerse como workbook con 2 hojas
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['P&L', 'Movimientos']);
  });

  it('pasa usuarioId tanto al use case como a la búsqueda de movimientos', async () => {
    mockPylUseCase.execute.mockResolvedValue(pylData);
    mockRegistroRepo.search.mockResolvedValue([]);

    await service.exportar({ salonId: 1, desde: '2026-05-01', hasta: '2026-05-31', usuarioId: 5 });

    expect(mockPylUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 5 }),
    );
    expect(mockRegistroRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 5 }),
    );
  });

  it('excluye registros ANULADO de los movimientos', async () => {
    mockPylUseCase.execute.mockResolvedValue(emptyPyl);
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro(),
      buildRegistro({ estado: EstadoRegistro.ANULADO, id: 99 }),
    ]);

    const result = await service.exportar({ salonId: 1, desde: '2026-06-01', hasta: '2026-06-30' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Movimientos')!;
    // 1 header + 1 registro activo (el ANULADO no aparece)
    expect(sheet.rowCount).toBe(2);
  });

  it('sin relaciones cliente/usuario usa fallbacks con IDs y valorFinal ausente usa montoTotal', async () => {
    mockPylUseCase.execute.mockResolvedValue(emptyPyl);
    mockRegistroRepo.search.mockResolvedValue([
      {
        estado: EstadoRegistro.ACTIVO,
        creadoEn: new Date('2026-06-10T15:00:00.000Z'),
        totalServicios: 100000,
        totalProductos: 20000,
        montoTotal: 125000,
        propina: 5000,
        comisionCalculada: 16000,
        valorFinal: null,
        clienteId: 7,
        usuarioId: 3,
        // sin cliente/usuario cargados
      },
    ]);

    const result = await service.exportar({ salonId: 1, desde: '2026-06-01', hasta: '2026-06-30' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Movimientos')!;
    expect(sheet.getCell('B2').value).toBe('Cliente #7');
    expect(sheet.getCell('C2').value).toBe('Empleada #3');
    // valorFinal null → usa montoTotal 125000
    expect(sheet.getCell('H2').value).toBe(125000);
  });

  it('sin desde/hasta usa el mes actual de Colombia (defaults) en filename y query', async () => {
    mockPylUseCase.execute.mockResolvedValue(emptyPyl);
    mockRegistroRepo.search.mockResolvedValue([]);

    const result = await service.exportar({ salonId: 1 });

    const hoy = new Date();
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    expect(result.filename).toMatch(new RegExp(`^pyl_${mes}-\\d{2}_${mes}-\\d{2}\\.xlsx$`));
    expect(mockPylUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: 1, desde: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    );
  });

  it('gastosPorCategoria vacío no agrega filas extra en la hoja P&L', () => {
    const wb = service.buildPyLWorkbook(emptyPyl, []);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const labels = rows.map((r) => r.getCell(1).value);
    expect(labels.some((l) => String(l).startsWith('Gastos por categoría'))).toBe(false);
    expect(labels).toContain('Total gastos');
  });
});
