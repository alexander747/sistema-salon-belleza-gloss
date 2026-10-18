import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
  ExcelExportService,
  registroAMovimientos,
  resumenFiadoDeRegistros,
  type FiadoResumen,
  type RegistroMovimiento,
} from '../ExcelExportService';
import type { PyLMensualOutput } from '../../use-cases/reporte/PyLMensualUseCase';
import type { PagoPeriodoDTO } from '../../dtos/PagoPeriodoDTO';
import {
  EstadoRegistro,
  type RegistroServicioEntity,
} from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

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
  comprasInventario: 100000,
  costoProductos: 21000,
  devoluciones: 20000,
  nomina: 0,
  pagosPrestamo: 0,
  contribucion: 222000,
  gastosNegocio: 280000,
  devolucionesNegocio: 20000,
  utilidadNeta: -78000,
};

/** Period fiado aggregates shown in the FIADO block. */
const fiadoData: FiadoResumen = {
  generado: 230000,
  cobrado: 140000,
  pendiente: 90000,
};

const movimientos: RegistroMovimiento[] = [
  {
    fecha: '2026-05-15',
    cliente: 'María Pérez',
    empleada: 'Ana Gómez',
    tipo: 'Servicio',
    concepto: 'Corte',
    cantidad: 1,
    precioUnitario: 90000,
    subtotal: 90000,
    totalVenta: 113000,
    montoPagado: 113000,
    montoPagadoAlVender: 113000,
    montoCobradoDespues: 0,
    montoFiado: 0,
    montoPendiente: 0,
    estadoCobro: 'PAGADO',
    fechaUltimoCobro: null,
  },
  {
    fecha: '2026-05-20',
    cliente: 'Luis Torres',
    empleada: 'Ana Gómez',
    tipo: 'Servicio',
    concepto: 'Manicure',
    cantidad: 1,
    precioUnitario: 100000,
    subtotal: 100000,
    totalVenta: 105000,
    montoPagado: 60000,
    montoPagadoAlVender: 0,
    montoCobradoDespues: 60000,
    montoFiado: 100000,
    montoPendiente: 40000,
    estadoCobro: 'PARCIAL',
    fechaUltimoCobro: '2026-05-28',
  },
  {
    fecha: '2026-05-25',
    cliente: 'Sofía Ruiz',
    empleada: 'Ana Gómez',
    tipo: 'Producto',
    concepto: 'Shampoo',
    cantidad: 2,
    precioUnitario: 25000,
    subtotal: 50000,
    totalVenta: 50000,
    montoPagado: 0,
    montoPagadoAlVender: 0,
    montoCobradoDespues: 0,
    montoFiado: 50000,
    montoPendiente: 50000,
    estadoCobro: 'FIADO',
    fechaUltimoCobro: null,
  },
  {
    fecha: '2026-05-10',
    cliente: 'Carla Méndez',
    empleada: 'Ana Gómez',
    tipo: 'Servicio',
    concepto: 'Tinte',
    cantidad: 1,
    precioUnitario: 80000,
    subtotal: 80000,
    totalVenta: 80000,
    montoPagado: 80000,
    montoPagadoAlVender: 0,
    montoCobradoDespues: 80000,
    montoFiado: 80000,
    montoPendiente: 0,
    estadoCobro: 'PAGADO',
    fechaUltimoCobro: '2026-05-30',
  },
];

/** Payments received in the period (Cobros del período sheet). */
const cobros: PagoPeriodoDTO[] = [
  {
    pagoId: 1,
    fechaCobro: '2026-05-15',
    registroId: 1,
    cliente: 'María Pérez',
    empleada: 'Ana Gómez',
    metodoPago: 'EFECTIVO',
    monto: 113000,
  },
  {
    pagoId: 2,
    fechaCobro: '2026-05-28',
    registroId: 2,
    cliente: 'Luis Torres',
    empleada: 'Ana Gómez',
    metodoPago: 'TRANSFERENCIA',
    monto: 60000,
  },
  {
    pagoId: 3,
    fechaCobro: '2026-05-30',
    registroId: 4,
    cliente: 'Carla Méndez',
    empleada: 'Ana Gómez',
    metodoPago: 'TARJETA',
    monto: 80000,
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
  comprasInventario: 0,
  costoProductos: 0,
  devoluciones: 0,
  nomina: 0,
  pagosPrestamo: 0,
  contribucion: 0,
  gastosNegocio: 0,
  devolucionesNegocio: 0,
  utilidadNeta: 0,
};

const emptyFiado: FiadoResumen = { generado: 0, cobrado: 0, pendiente: 0 };

const buildRegistro = (overrides: Partial<Record<string, unknown>> = {}) => ({
  estado: EstadoRegistro.ACTIVO,
  creadoEn: new Date('2026-05-15T15:00:00.000Z'),
  fechaHora: null,
  totalServicios: 100000,
  totalProductos: 20000,
  cantidadProductosVendidos: 2,
  montoTotal: 125000,
  propina: 5000,
  comisionCalculada: 16000,
  valorFinal: 113000,
  montoFiado: 0,
  montoPendiente: 0,
  clienteId: 1,
  usuarioId: 4,
  cliente: { nombre: 'María Pérez' },
  usuario: { nombre: 'Ana Gómez' },
  serviciosItems: [
    { servicioId: 1, nombreServicio: 'Corte', precioServicio: 100000 },
  ],
  productosVendidos: [
    {
      productoId: 1,
      cantidad: 2,
      precioVentaUnitario: 10000,
      subtotal: 20000,
      producto: { nombre: 'Shampoo' },
    },
  ],
  pagos: [{ monto: 113000, creadoEn: new Date('2026-05-15T15:00:00.000Z') }],
  ...overrides,
});

const asRegistro = (overrides: Partial<Record<string, unknown>> = {}) =>
  buildRegistro(overrides) as unknown as RegistroServicioEntity;

describe('ExcelExportService.buildPyLWorkbook', () => {
  let service: ExcelExportService;

  beforeEach(() => {
    service = new ExcelExportService(
      { execute: vi.fn() } as never,
      {} as never,
      { findBySalonAndPeriodo: vi.fn().mockResolvedValue([]) } as never,
    );
  });

  it('crea un workbook con tres hojas: P&L, Movimientos y Cobros del período', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData, cobros);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'P&L',
      'Movimientos',
      'Cobros del período',
    ]);
  });

  it('la hoja P&L tiene encabezado con estilo bold y fill #4f46e5', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    const headerCell = sheet.getCell('A1');
    expect(headerCell.font.bold).toBe(true);
    expect(headerCell.fill).toMatchObject({ fgColor: { argb: 'FF4F46E5' } });
  });

  it('la hoja P&L contiene filas de totales con valores del P&L (utilidad neta)', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const labels = rows.map((r) => r.getCell(1).value);
    expect(labels).toContain('Utilidad neta');
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).value).toBe(-78000);
    const ingresosRow = rows.find((r) => r.getCell(1).value === 'Ingresos netos')!;
    expect(ingresosRow.getCell(2).value).toBe(315000);
  });

  it('la hoja P&L omite Fiado del período, Ingresos brutos y Descuentos', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const labels = rows.map((r) => r.getCell(1).value);

    expect(labels).not.toContain('Fiado del período');
    expect(labels).not.toContain('Ingresos brutos');
    expect(labels).not.toContain('Descuentos');

    // Net figures and the FIADO block stay.
    const byLabel = (label: string) => rows.find((r) => r.getCell(1).value === label)!;
    expect(byLabel('Ingresos netos').getCell(2).value).toBe(315000);
    expect(byLabel('FIADO DEL PERÍODO')).toBeDefined();
    expect(byLabel('Fiado generado').getCell(2).value).toBe(230000);
    expect(byLabel('Cobrado del fiado').getCell(2).value).toBe(140000);
    expect(byLabel('Fiado por cobrar').getCell(2).value).toBe(90000);
    expect(byLabel('Total fiado (cobrado + por cobrar)').getCell(2).value).toBe(230000);
  });

  it('la hoja P&L muestra las líneas cash: Cobrado y Deudas por cobrar', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;

    const cobradoRow = rows.find((r) => r.getCell(1).value === 'Cobrado')!;
    expect(cobradoRow.getCell(2).value).toBe(330000);
    const deudasRow = rows.find((r) => r.getCell(1).value === 'Deudas por cobrar')!;
    expect(deudasRow.getCell(2).value).toBe(50000);
    // Utilidad neta es cash (cobrado − costos) y aparece después de Deudas
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).value).toBe(-78000);
  });

  it('la hoja P&L muestra el COGS (costo de productos) y las compras de inventario', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;

    const cogsRow = rows.find((r) => r.getCell(1).value === 'Costo de productos vendidos')!;
    expect(cogsRow.getCell(2).value).toBe(21000);
    const comprasRow = rows.find((r) => r.getCell(1).value === 'Compras de inventario (no es gasto)')!;
    expect(comprasRow.getCell(2).value).toBe(100000);
  });

  it('las celdas de dinero usan formato COP $#,##0', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).numFmt).toBe('$#,##0');
  });

  it('define anchos de columna para la hoja P&L', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    expect(sheet.getColumn(1).width).toBeGreaterThan(0);
    expect(sheet.getColumn(2).width).toBeGreaterThan(0);
  });

  it('la hoja P&L agrega el bloque FIADO con generado, cobrado, por cobrar y total', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const byLabel = (label: string) => rows.find((r) => r.getCell(1).value === label)!;

    expect(byLabel('FIADO DEL PERÍODO')).toBeDefined();
    expect(byLabel('Fiado generado').getCell(2).value).toBe(230000);
    expect(byLabel('Cobrado del fiado').getCell(2).value).toBe(140000);
    expect(byLabel('Fiado por cobrar').getCell(2).value).toBe(90000);
    expect(byLabel('Total fiado (cobrado + por cobrar)').getCell(2).value).toBe(230000);
    expect(byLabel('Fiado generado').getCell(2).numFmt).toBe('$#,##0');
    expect(byLabel('Total fiado (cobrado + por cobrar)').font.bold).toBe(true);
  });

  it('la hoja Movimientos separa pagado al vender y cobrado después por línea', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData, cobros);
    const sheet = wb.getWorksheet('Movimientos')!;

    expect(sheet.getCell('A1').value).toBe('Fecha');
    expect(sheet.getCell('B1').value).toBe('Cliente');
    expect(sheet.getCell('C1').value).toBe('Empleada');
    expect(sheet.getCell('D1').value).toBe('Tipo');
    expect(sheet.getCell('E1').value).toBe('Concepto');
    expect(sheet.getCell('F1').value).toBe('Cantidad');
    expect(sheet.getCell('G1').value).toBe('Precio unitario');
    expect(sheet.getCell('H1').value).toBe('Subtotal');
    expect(sheet.getCell('I1').value).toBe('Total venta');
    expect(sheet.getCell('J1').value).toBe('Pagado al vender');
    expect(sheet.getCell('K1').value).toBe('Cobrado después');
    expect(sheet.getCell('L1').value).toBe('Fiado');
    expect(sheet.getCell('M1').value).toBe('Pendiente');
    expect(sheet.getCell('N1').value).toBe('Estado cobro');
    expect(sheet.getCell('O1').value).toBe('Fecha del último cobro');
    // 1 header + 4 line rows
    expect(sheet.rowCount).toBe(5);

    const rows = sheet.getRows(1, sheet.rowCount)!;
    const byConcepto = (concepto: string) =>
      rows.find((r) => r.getCell('E').value === concepto)!;

    const pagado = byConcepto('Corte');
    expect(pagado.getCell('A').value).toBe('2026-05-15');
    expect(pagado.getCell('B').value).toBe('María Pérez');
    expect(pagado.getCell('C').value).toBe('Ana Gómez');
    expect(pagado.getCell('D').value).toBe('Servicio');
    expect(pagado.getCell('F').value).toBe(1);
    expect(pagado.getCell('G').value).toBe(90000);
    expect(pagado.getCell('H').value).toBe(90000);
    expect(pagado.getCell('I').value).toBe(113000);
    expect(pagado.getCell('J').value).toBe(113000);
    expect(pagado.getCell('K').value).toBe(0);
    expect(pagado.getCell('L').value).toBe(0);
    expect(pagado.getCell('M').value).toBe(0);
    expect(pagado.getCell('N').value).toBe('PAGADO');
    expect(pagado.getCell('O').value).toBeNull();

    const parcial = byConcepto('Manicure');
    expect(parcial.getCell('N').value).toBe('PARCIAL');
    expect(parcial.getCell('J').value).toBe(0);
    expect(parcial.getCell('K').value).toBe(60000);
    expect(parcial.getCell('L').value).toBe(100000);
    expect(parcial.getCell('M').value).toBe(40000);
    expect(parcial.getCell('O').value).toBe('2026-05-28');

    const fiado = byConcepto('Shampoo');
    expect(fiado.getCell('D').value).toBe('Producto');
    expect(fiado.getCell('F').value).toBe(2);
    expect(fiado.getCell('G').value).toBe(25000);
    expect(fiado.getCell('H').value).toBe(50000);
    expect(fiado.getCell('J').value).toBe(0);
    expect(fiado.getCell('K').value).toBe(0);
    expect(fiado.getCell('N').value).toBe('FIADO');
    expect(fiado.getCell('O').value).toBeNull();

    const cobradoDespues = byConcepto('Tinte');
    expect(cobradoDespues.getCell('N').value).toBe('PAGADO');
    expect(cobradoDespues.getCell('J').value).toBe(0);
    expect(cobradoDespues.getCell('K').value).toBe(80000);
    expect(cobradoDespues.getCell('O').value).toBe('2026-05-30');

    // COP format on money columns
    for (const col of ['G', 'H', 'I', 'J', 'K', 'L', 'M']) {
      expect(pagado.getCell(col).numFmt).toBe('$#,##0');
    }
  });

  it('la hoja Cobros del período lista cada pago con fecha, venta y total', () => {
    const wb = service.buildPyLWorkbook(pylData, movimientos, fiadoData, cobros);
    const sheet = wb.getWorksheet('Cobros del período')!;

    expect(sheet.getCell('A1').value).toBe('Fecha de cobro');
    expect(sheet.getCell('B1').value).toBe('Venta #');
    expect(sheet.getCell('C1').value).toBe('Cliente');
    expect(sheet.getCell('D1').value).toBe('Empleada');
    expect(sheet.getCell('E1').value).toBe('Método de pago');
    expect(sheet.getCell('F1').value).toBe('Monto');
    // 1 header + 3 payments + 1 TOTAL
    expect(sheet.rowCount).toBe(5);

    expect(sheet.getCell('A2').value).toBe('2026-05-15');
    expect(sheet.getCell('B2').value).toBe(1);
    expect(sheet.getCell('C2').value).toBe('María Pérez');
    expect(sheet.getCell('D2').value).toBe('Ana Gómez');
    expect(sheet.getCell('E2').value).toBe('EFECTIVO');
    expect(sheet.getCell('F2').value).toBe(113000);

    expect(sheet.getCell('A3').value).toBe('2026-05-28');
    expect(sheet.getCell('F3').value).toBe(60000);

    const totalRow = sheet.getRow(sheet.rowCount);
    expect(totalRow.getCell('A').value).toBe('TOTAL');
    expect(totalRow.getCell('F').value).toBe(253000);
    expect(totalRow.getCell('F').numFmt).toBe('$#,##0');
    expect(totalRow.font.bold).toBe(true);
  });

  it('período vacío: las tres hojas existen con ceros y solo encabezados', () => {
    const wb = service.buildPyLWorkbook(emptyPyl, [], emptyFiado);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'P&L',
      'Movimientos',
      'Cobros del período',
    ]);
    const pylSheet = wb.getWorksheet('P&L')!;
    const rows = pylSheet.getRows(1, pylSheet.rowCount)!;
    const utilidadRow = rows.find((r) => r.getCell(1).value === 'Utilidad neta')!;
    expect(utilidadRow.getCell(2).value).toBe(0);
    const cobradoRow = rows.find((r) => r.getCell(1).value === 'Cobrado')!;
    expect(cobradoRow.getCell(2).value).toBe(0);
    const fiadoRow = rows.find((r) => r.getCell(1).value === 'Fiado generado')!;
    expect(fiadoRow.getCell(2).value).toBe(0);
    const movSheet = wb.getWorksheet('Movimientos')!;
    expect(movSheet.rowCount).toBe(1); // solo encabezado
    const cobrosSheet = wb.getWorksheet('Cobros del período')!;
    expect(cobrosSheet.rowCount).toBe(2); // encabezado + TOTAL
    expect(cobrosSheet.getCell('A2').value).toBe('TOTAL');
    expect(cobrosSheet.getCell('F2').value).toBe(0);
  });
});

describe('registroAMovimientos', () => {
  it('agrupa los items de servicio por unidad en una sola línea con cantidad', () => {
    const rows = registroAMovimientos(
      asRegistro({
        totalServicios: 90000,
        totalProductos: 0,
        cantidadProductosVendidos: 0,
        montoTotal: 90000,
        valorFinal: 90000,
        montoFiado: 90000,
        montoPendiente: 90000,
        serviciosItems: [
          { servicioId: 1, nombreServicio: 'Corte', precioServicio: 45000 },
          { servicioId: 1, nombreServicio: 'Corte', precioServicio: 45000 },
        ],
        productosVendidos: [],
        pagos: [],
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tipo: 'Servicio',
      concepto: 'Corte',
      cantidad: 2,
      precioUnitario: 45000,
      subtotal: 90000,
      montoPagadoAlVender: 0,
      montoCobradoDespues: 0,
      estadoCobro: 'FIADO',
      fechaUltimoCobro: null,
    });
  });

  it('usa líneas de respaldo para registros legacy sin items', () => {
    const rows = registroAMovimientos(
      asRegistro({
        totalServicios: 100000,
        totalProductos: 20000,
        cantidadProductosVendidos: 2,
        montoTotal: 125000,
        valorFinal: 125000,
        montoFiado: null,
        montoPendiente: 25000,
        serviciosItems: undefined,
        productosVendidos: undefined,
        pagos: [{ monto: 100000, creadoEn: new Date('2026-06-12T15:00:00.000Z') }],
        descripcionServicio: 'Corte y peinado',
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tipo: 'Servicio',
      concepto: 'Corte y peinado',
      cantidad: 1,
      precioUnitario: 100000,
      subtotal: 100000,
      montoPagadoAlVender: 0,
      montoCobradoDespues: 100000,
      montoFiado: 25000,
      montoPendiente: 25000,
      estadoCobro: 'PARCIAL',
      fechaUltimoCobro: '2026-06-12',
    });
    expect(rows[1]).toMatchObject({
      tipo: 'Producto',
      concepto: 'Productos',
      cantidad: 2,
      precioUnitario: 10000,
      subtotal: 20000,
    });
  });

  it('marca PAGADO y usa la última fecha de pago cuando ya no hay pendiente', () => {
    const rows = registroAMovimientos(
      asRegistro({
        montoFiado: 80000,
        montoPendiente: 0,
        pagos: [
          { monto: 30000, creadoEn: new Date('2026-05-28T15:00:00.000Z') },
          { monto: 50000, creadoEn: new Date('2026-05-30T15:00:00.000Z') },
        ],
      }),
    );

    expect(rows[0].estadoCobro).toBe('PAGADO');
    expect(rows[0].montoPagadoAlVender).toBe(0);
    expect(rows[0].montoCobradoDespues).toBe(80000);
    expect(rows[0].fechaUltimoCobro).toBe('2026-05-30');
  });

  it('separa pagos del día de la venta de los cobros posteriores al fiado', () => {
    const rows = registroAMovimientos(
      asRegistro({
        // Sale date from `creadoEn` (2026-05-15).
        montoFiado: 70000,
        montoPendiente: 0,
        pagos: [
          { monto: 40000, creadoEn: new Date('2026-05-15T15:00:00.000Z') },
          { monto: 30000, creadoEn: new Date('2026-05-22T15:00:00.000Z') },
        ],
      }),
    );

    expect(rows[0].montoPagado).toBe(70000);
    expect(rows[0].montoPagadoAlVender).toBe(40000);
    expect(rows[0].montoCobradoDespues).toBe(30000);
    expect(rows[0].fechaUltimoCobro).toBe('2026-05-22');
    // The last collection date is blank when every payment was received at sale time.
    const atSaleOnly = registroAMovimientos(
      asRegistro({
        montoPendiente: 0,
        pagos: [{ monto: 70000, creadoEn: new Date('2026-05-15T15:00:00.000Z') }],
      }),
    );
    expect(atSaleOnly[0].montoPagadoAlVender).toBe(70000);
    expect(atSaleOnly[0].montoCobradoDespues).toBe(0);
    expect(atSaleOnly[0].fechaUltimoCobro).toBeNull();
  });

  it('usa la fecha de la caja del pago para clasificar cobros', () => {
    const rows = registroAMovimientos(
      asRegistro({
        montoPendiente: 0,
        pagos: [
          {
            monto: 70000,
            creadoEn: new Date('2026-06-01T15:00:00.000Z'),
            caja: { fechaCaja: '2026-05-15' },
          },
        ],
      }),
    );

    expect(rows[0].montoPagadoAlVender).toBe(70000);
    expect(rows[0].montoCobradoDespues).toBe(0);
    expect(rows[0].fechaUltimoCobro).toBeNull();
  });
});

describe('resumenFiadoDeRegistros', () => {
  it('suma el snapshot con fallback legacy y excluye ANULADO', () => {
    const resumen = resumenFiadoDeRegistros([
      asRegistro({ montoFiado: 100000, montoPendiente: 40000 }),
      asRegistro({ montoFiado: null, montoPendiente: 25000 }),
      asRegistro({ montoFiado: 50000, montoPendiente: 50000 }),
      asRegistro({ estado: EstadoRegistro.ANULADO, montoFiado: 999999, montoPendiente: 999999 }),
    ]);

    expect(resumen).toEqual({ generado: 175000, cobrado: 60000, pendiente: 115000 });
  });
});

describe('ExcelExportService.exportar', () => {
  let service: ExcelExportService;
  let mockPylUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockRegistroRepo: { search: ReturnType<typeof vi.fn> };
  let mockPagoPeriodoRepo: { findBySalonAndPeriodo: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPylUseCase = { execute: vi.fn() };
    mockRegistroRepo = { search: vi.fn() };
    mockPagoPeriodoRepo = {
      findBySalonAndPeriodo: vi.fn().mockResolvedValue([]),
    };
    service = new ExcelExportService(
      mockPylUseCase as never,
      mockRegistroRepo as never,
      mockPagoPeriodoRepo as never,
    );
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
    expect(mockPagoPeriodoRepo.findBySalonAndPeriodo).toHaveBeenCalledWith({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });
    // XLSX magic bytes: PK\x03\x04
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');
    // Filename pyl_<desde>_<hasta>.xlsx
    expect(result.filename).toBe('pyl_2026-05-01_2026-05-31.xlsx');

    // El buffer puede releerse como workbook con 3 hojas
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'P&L',
      'Movimientos',
      'Cobros del período',
    ]);
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
    expect(mockPagoPeriodoRepo.findBySalonAndPeriodo).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 5 }),
    );
  });

  it('exporta el bloque fiado y el estado por línea del período', async () => {
    mockPylUseCase.execute.mockResolvedValue({ ...pylData, fiadoPeriodo: 90000 });
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({ id: 1 }),
      buildRegistro({
        id: 2,
        creadoEn: new Date('2026-05-20T15:00:00.000Z'),
        totalServicios: 100000,
        totalProductos: 0,
        cantidadProductosVendidos: 0,
        montoTotal: 105000,
        valorFinal: 105000,
        montoFiado: 100000,
        montoPendiente: 40000,
        serviciosItems: [
          { servicioId: 2, nombreServicio: 'Manicure', precioServicio: 100000 },
        ],
        productosVendidos: [],
        pagos: [{ monto: 60000, creadoEn: new Date('2026-05-28T17:00:00.000Z') }],
        cliente: { nombre: 'Luis Torres' },
      }),
      buildRegistro({
        id: 3,
        creadoEn: new Date('2026-05-25T15:00:00.000Z'),
        totalServicios: 0,
        totalProductos: 50000,
        cantidadProductosVendidos: 2,
        propina: 0,
        montoTotal: 50000,
        valorFinal: 50000,
        montoFiado: 50000,
        montoPendiente: 50000,
        serviciosItems: [],
        productosVendidos: [
          {
            productoId: 2,
            cantidad: 2,
            precioVentaUnitario: 25000,
            subtotal: 50000,
            producto: { nombre: 'Tratamiento' },
          },
        ],
        pagos: [],
        cliente: { nombre: 'Sofía Ruiz' },
      }),
      buildRegistro({
        id: 4,
        creadoEn: new Date('2026-05-10T15:00:00.000Z'),
        totalServicios: 80000,
        totalProductos: 0,
        cantidadProductosVendidos: 0,
        propina: 0,
        montoTotal: 80000,
        valorFinal: 80000,
        montoFiado: 80000,
        montoPendiente: 0,
        serviciosItems: [
          { servicioId: 3, nombreServicio: 'Tinte', precioServicio: 80000 },
        ],
        productosVendidos: [],
        pagos: [{ monto: 80000, creadoEn: new Date('2026-05-30T18:00:00.000Z') }],
        cliente: { nombre: 'Carla Méndez' },
      }),
    ]);

    const result = await service.exportar({ salonId: 1, desde: '2026-05-01', hasta: '2026-05-31' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);

    const pylSheet = wb.getWorksheet('P&L')!;
    const pylRows = pylSheet.getRows(1, pylSheet.rowCount)!;
    const byLabel = (label: string) => pylRows.find((r) => r.getCell(1).value === label)!;
    expect(byLabel('Fiado generado').getCell(2).value).toBe(230000);
    expect(byLabel('Cobrado del fiado').getCell(2).value).toBe(140000);
    expect(byLabel('Fiado por cobrar').getCell(2).value).toBe(90000);
    expect(byLabel('Total fiado (cobrado + por cobrar)').getCell(2).value).toBe(230000);

    const movSheet = wb.getWorksheet('Movimientos')!;
    const movRows = movSheet.getRows(1, movSheet.rowCount)!;
    const byConcepto = (concepto: string) =>
      movRows.find((r) => r.getCell('E').value === concepto)!;

    expect(byConcepto('Corte').getCell('N').value).toBe('PAGADO');
    expect(byConcepto('Corte').getCell('J').value).toBe(113000);
    expect(byConcepto('Corte').getCell('K').value).toBe(0);
    expect(byConcepto('Corte').getCell('O').value).toBeNull();
    expect(byConcepto('Manicure').getCell('N').value).toBe('PARCIAL');
    expect(byConcepto('Manicure').getCell('J').value).toBe(0);
    expect(byConcepto('Manicure').getCell('K').value).toBe(60000);
    expect(byConcepto('Manicure').getCell('O').value).toBe('2026-05-28');
    expect(byConcepto('Tratamiento').getCell('N').value).toBe('FIADO');
    expect(byConcepto('Tratamiento').getCell('K').value).toBe(0);
    expect(byConcepto('Tratamiento').getCell('O').value).toBeNull();
    expect(byConcepto('Tinte').getCell('N').value).toBe('PAGADO');
    expect(byConcepto('Tinte').getCell('J').value).toBe(0);
    expect(byConcepto('Tinte').getCell('K').value).toBe(80000);
    expect(byConcepto('Tinte').getCell('O').value).toBe('2026-05-30');
  });

  it('un fiado cobrado después reconcilia Movimientos con Cobros del período', async () => {
    // Collected income in the period is exactly the later payment.
    mockPylUseCase.execute.mockResolvedValue({ ...pylData, cobrado: 60000 });
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        id: 1,
        creadoEn: new Date('2026-05-15T15:00:00.000Z'),
        totalServicios: 60000,
        totalProductos: 0,
        cantidadProductosVendidos: 0,
        montoTotal: 60000,
        propina: 0,
        valorFinal: 60000,
        montoFiado: 60000,
        montoPendiente: 0,
        serviciosItems: [
          { servicioId: 1, nombreServicio: 'Corte', precioServicio: 60000 },
        ],
        productosVendidos: [],
        pagos: [{ monto: 60000, creadoEn: new Date('2026-05-28T18:00:00.000Z') }],
        cliente: { nombre: 'María Pérez' },
      }),
    ]);
    mockPagoPeriodoRepo.findBySalonAndPeriodo.mockResolvedValue([
      {
        pagoId: 10,
        fechaCobro: '2026-05-28',
        registroId: 1,
        cliente: 'María Pérez',
        empleada: 'Ana Gómez',
        metodoPago: 'EFECTIVO',
        monto: 60000,
      },
    ]);

    const result = await service.exportar({ salonId: 1, desde: '2026-05-01', hasta: '2026-05-31' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);

    const movSheet = wb.getWorksheet('Movimientos')!;
    expect(movSheet.getCell('E2').value).toBe('Corte');
    expect(movSheet.getCell('J2').value).toBe(0); // Pagado al vender
    expect(movSheet.getCell('K2').value).toBe(60000); // Cobrado después
    expect(movSheet.getCell('O2').value).toBe('2026-05-28'); // último cobro

    const cobrosSheet = wb.getWorksheet('Cobros del período')!;
    expect(cobrosSheet.getCell('A2').value).toBe('2026-05-28');
    expect(cobrosSheet.getCell('B2').value).toBe(1);
    expect(cobrosSheet.getCell('C2').value).toBe('María Pérez');
    expect(cobrosSheet.getCell('E2').value).toBe('EFECTIVO');
    expect(cobrosSheet.getCell('F2').value).toBe(60000);
    const totalRow = cobrosSheet.getRow(cobrosSheet.rowCount);
    expect(totalRow.getCell('A').value).toBe('TOTAL');
    expect(totalRow.getCell('F').value).toBe(60000);
    // The sheet total is the period's collected income (P&L "Cobrado").
    const pylSheet = wb.getWorksheet('P&L')!;
    const cobradoRow = pylSheet
      .getRows(1, pylSheet.rowCount)!
      .find((r) => r.getCell(1).value === 'Cobrado')!;
    expect(totalRow.getCell('F').value).toBe(cobradoRow.getCell(2).value);
  });

  it('excluye registros ANULADO de los movimientos y del bloque fiado', async () => {
    mockPylUseCase.execute.mockResolvedValue(emptyPyl);
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro(),
      buildRegistro({
        estado: EstadoRegistro.ANULADO,
        id: 99,
        montoFiado: 999999,
        montoPendiente: 999999,
      }),
    ]);

    const result = await service.exportar({ salonId: 1, desde: '2026-06-01', hasta: '2026-06-30' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Movimientos')!;
    // 1 header + líneas del único registro activo (Corte + Shampoo)
    expect(sheet.rowCount).toBe(3);

    const pylSheet = wb.getWorksheet('P&L')!;
    const rows = pylSheet.getRows(1, pylSheet.rowCount)!;
    const fiadoRow = rows.find((r) => r.getCell(1).value === 'Fiado generado')!;
    expect(fiadoRow.getCell(2).value).toBe(0);
  });

  it('sin relaciones cliente/usuario usa fallbacks con IDs y valorFinal ausente usa montoTotal', async () => {
    mockPylUseCase.execute.mockResolvedValue(emptyPyl);
    mockRegistroRepo.search.mockResolvedValue([
      {
        estado: EstadoRegistro.ACTIVO,
        creadoEn: new Date('2026-06-10T15:00:00.000Z'),
        totalServicios: 100000,
        totalProductos: 20000,
        cantidadProductosVendidos: 2,
        montoTotal: 125000,
        propina: 5000,
        comisionCalculada: 16000,
        valorFinal: null,
        montoFiado: null,
        montoPendiente: 0,
        clienteId: 7,
        usuarioId: 3,
        serviciosItems: [
          { servicioId: 1, nombreServicio: 'Corte', precioServicio: 100000 },
        ],
        productosVendidos: [],
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
    expect(sheet.getCell('I2').value).toBe(125000);
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
    const wb = service.buildPyLWorkbook(emptyPyl, [], emptyFiado);
    const sheet = wb.getWorksheet('P&L')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const labels = rows.map((r) => r.getCell(1).value);
    expect(labels.some((l) => String(l).startsWith('Gastos por categoría'))).toBe(false);
    expect(labels).toContain('Total gastos');
  });
});
