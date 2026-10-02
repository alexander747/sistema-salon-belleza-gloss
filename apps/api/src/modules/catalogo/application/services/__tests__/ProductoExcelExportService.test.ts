import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
  ProductoExcelExportService,
  type ProductoInventarioRow,
} from '../ProductoExcelExportService';

const rowA: ProductoInventarioRow = {
  nombre: 'Shampoo A',
  marca: 'Loreal',
  codigoBarras: '770000000001',
  color: 'Rojo',
  tamano: '500ml',
  tipoInventario: 'RETAIL',
  precioCompra: 100,
  precioVenta: 150,
  margenGanancia: 50,
  cantidadStock: 2,
  stockMinimo: 1,
};

const rowB: ProductoInventarioRow = {
  nombre: 'Cera B',
  marca: null,
  codigoBarras: null,
  color: null,
  tamano: null,
  tipoInventario: 'INTERNAL',
  precioCompra: 200,
  precioVenta: 300,
  margenGanancia: 50,
  cantidadStock: 10,
  stockMinimo: 0,
};

describe('ProductoExcelExportService.buildProductosWorkbook', () => {
  let service: ProductoExcelExportService;

  beforeEach(() => {
    service = new ProductoExcelExportService({ execute: vi.fn() } as never);
  });

  it('crea un workbook con dos hojas: Productos y Totales', () => {
    const wb = service.buildProductosWorkbook([rowA, rowB]);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Productos', 'Totales']);
  });

  it('la hoja Productos tiene el encabezado de 13 columnas con estilo', () => {
    const wb = service.buildProductosWorkbook([rowA]);
    const sheet = wb.getWorksheet('Productos')!;
    expect(sheet.getCell('A1').value).toBe('Nombre');
    expect(sheet.getCell('B1').value).toBe('Marca');
    expect(sheet.getCell('C1').value).toBe('Código de barras');
    expect(sheet.getCell('G1').value).toBe('Precio compra (PMP)');
    expect(sheet.getCell('H1').value).toBe('Precio venta');
    expect(sheet.getCell('I1').value).toBe('Margen %');
    expect(sheet.getCell('L1').value).toBe('Valor inventario compra');
    expect(sheet.getCell('M1').value).toBe('Valor inventario venta');
    expect(sheet.getCell('A1').font.bold).toBe(true);
    expect(sheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FF4F46E5' } });
  });

  it('una fila por producto con sus valores y valor de inventario calculado', () => {
    const wb = service.buildProductosWorkbook([rowA, rowB]);
    const sheet = wb.getWorksheet('Productos')!;
    // 1 header + 2 filas
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getCell('A2').value).toBe('Shampoo A');
    expect(sheet.getCell('B2').value).toBe('Loreal');
    expect(sheet.getCell('F2').value).toBe('Venta');
    expect(sheet.getCell('G2').value).toBe(100);
    expect(sheet.getCell('H2').value).toBe(150);
    expect(sheet.getCell('I2').value).toBe(50);
    expect(sheet.getCell('J2').value).toBe(2);
    expect(sheet.getCell('K2').value).toBe(1);
    // valor inventario compra = 100*2; venta = 150*2
    expect(sheet.getCell('L2').value).toBe(200);
    expect(sheet.getCell('M2').value).toBe(300);
    // fila B
    expect(sheet.getCell('A3').value).toBe('Cera B');
    expect(sheet.getCell('F3').value).toBe('Interno');
    expect(sheet.getCell('L3').value).toBe(2000);
    expect(sheet.getCell('M3').value).toBe(3000);
  });

  it('las columnas de dinero usan formato COP $#,##0', () => {
    const wb = service.buildProductosWorkbook([rowA]);
    const sheet = wb.getWorksheet('Productos')!;
    expect(sheet.getCell('G2').numFmt).toBe('$#,##0');
    expect(sheet.getCell('H2').numFmt).toBe('$#,##0');
    expect(sheet.getCell('L2').numFmt).toBe('$#,##0');
    expect(sheet.getCell('M2').numFmt).toBe('$#,##0');
  });

  it('hoja Totales suma cantidad, compra y venta de todos los productos', () => {
    const wb = service.buildProductosWorkbook([rowA, rowB]);
    const sheet = wb.getWorksheet('Totales')!;
    const rows = sheet.getRows(1, sheet.rowCount)!;
    const byLabel = (label: string) =>
      rows.find((r) => r.getCell(1).value === label)!;
    // A(100,150,2) + B(200,300,10) → 2 / 2200 / 3300
    expect(byLabel('Total de productos').getCell(2).value).toBe(2);
    expect(byLabel('Valor inventario a compra').getCell(2).value).toBe(2200);
    expect(byLabel('Valor inventario a venta').getCell(2).value).toBe(3300);
    expect(byLabel('Valor inventario a compra').getCell(2).numFmt).toBe('$#,##0');
  });

  it('salón vacío: Productos solo encabezado y Totales en 0', () => {
    const wb = service.buildProductosWorkbook([]);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Productos', 'Totales']);
    const prodSheet = wb.getWorksheet('Productos')!;
    expect(prodSheet.rowCount).toBe(1);
    const totSheet = wb.getWorksheet('Totales')!;
    const rows = totSheet.getRows(1, totSheet.rowCount)!;
    const byLabel = (label: string) =>
      rows.find((r) => r.getCell(1).value === label)!;
    expect(byLabel('Total de productos').getCell(2).value).toBe(0);
    expect(byLabel('Valor inventario a compra').getCell(2).value).toBe(0);
    expect(byLabel('Valor inventario a venta').getCell(2).value).toBe(0);
  });

  it('precioCompra 0 y stock 0 se muestran como 0 (nunca en blanco) y suman igual', () => {
    const sinCosto: ProductoInventarioRow = {
      ...rowA,
      nombre: 'Sin costo',
      precioCompra: 0,
      cantidadStock: 0,
    };
    const wb = service.buildProductosWorkbook([sinCosto, rowB]);
    const prodSheet = wb.getWorksheet('Productos')!;
    expect(prodSheet.getCell('G2').value).toBe(0);
    expect(prodSheet.getCell('J2').value).toBe(0);
    expect(prodSheet.getCell('L2').value).toBe(0);
    const totSheet = wb.getWorksheet('Totales')!;
    const rows = totSheet.getRows(1, totSheet.rowCount)!;
    const byLabel = (label: string) =>
      rows.find((r) => r.getCell(1).value === label)!;
    // Ambos productos cuentan aunque uno tenga costo/stock 0
    expect(byLabel('Total de productos').getCell(2).value).toBe(2);
    expect(byLabel('Valor inventario a compra').getCell(2).value).toBe(2000);
    expect(byLabel('Valor inventario a venta').getCell(2).value).toBe(3000);
  });
});

describe('ProductoExcelExportService.exportar', () => {
  let service: ProductoExcelExportService;
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockListUseCase = { execute: vi.fn() };
    service = new ProductoExcelExportService(mockListUseCase as never);
  });

  const dto = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    nombre: 'Shampoo',
    marca: 'Loreal',
    codigoBarras: '770',
    color: null,
    tamano: null,
    precioVenta: 150,
    precioCompra: 100,
    margenGanancia: 50,
    cantidadStock: 2,
    stockMinimo: 1,
    tipoInventario: 'RETAIL',
    ...overrides,
  });

  it('orquesta ListProductosUseCase con limit 0 y userRol, y devuelve buffer xlsx válido', async () => {
    mockListUseCase.execute.mockResolvedValue([dto(), dto({ id: 2, nombre: 'B', precioCompra: 200, precioVenta: 300, cantidadStock: 10 })]);

    const result = await service.exportar({ salonId: 1, userRol: 2 as never });

    expect(mockListUseCase.execute).toHaveBeenCalledWith({
      salonId: 1,
      limit: 0,
      userRol: 2,
    });
    // XLSX magic bytes: PK\x03\x04
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(result.filename).toMatch(/^productos_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Productos', 'Totales']);
  });

  it('acepta un resultado paginado (data) además del array plano', async () => {
    mockListUseCase.execute.mockResolvedValue({
      data: [dto()],
      meta: { page: 1, limit: 0, total: 1, totalPages: 1 },
    });

    const result = await service.exportar({ salonId: 1, userRol: 2 as never });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Productos')!;
    expect(sheet.rowCount).toBe(2);
  });
});
