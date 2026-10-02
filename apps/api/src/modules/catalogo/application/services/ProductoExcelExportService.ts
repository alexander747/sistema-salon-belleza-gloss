import { injectable, inject } from 'tsyringe';
import ExcelJS from 'exceljs';
import { Rol } from '@pos-final/types';
import { ListProductosUseCase } from '../use-cases/producto/ListProductosUseCase';
import type { ProductoDTO } from '../dtos/ProductoDTO';
import { getColombiaDateString } from '../../../../shared/colombia-date';

/** Fila de inventario para la hoja "Productos" del workbook exportado. */
export interface ProductoInventarioRow {
  nombre: string;
  marca: string | null;
  codigoBarras: string | null;
  color: string | null;
  tamano: string | null;
  tipoInventario: string;
  precioCompra: number;
  precioVenta: number;
  margenGanancia: number;
  cantidadStock: number;
  stockMinimo: number;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4F46E5' },
};

const COP_FORMAT = '$#,##0';

const PRODUCTOS_HEADER = [
  'Nombre',
  'Marca',
  'Código de barras',
  'Color',
  'Tamaño',
  'Tipo',
  'Precio compra (PMP)',
  'Precio venta',
  'Margen %',
  'Stock',
  'Stock mínimo',
  'Valor inventario compra',
  'Valor inventario venta',
];

const TOTALES_HEADER = ['Concepto', 'Valor'];

const PRODUCTOS_WIDTHS = [28, 18, 20, 14, 12, 12, 20, 18, 12, 10, 14, 24, 24];
const TOTALES_WIDTHS = [30, 20];

/** Columnas con formato de moneda en la hoja Productos (1-indexed). */
const PRODUCTOS_MONEY_COLS = [7, 8, 12, 13];

function estiloHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = HEADER_FILL;
  cell.alignment = { vertical: 'middle' };
}

/** RETAIL/INTERNAL se muestran en español, cualquier otro valor tal cual. */
function tipoLabel(tipoInventario: string): string {
  if (tipoInventario === 'RETAIL') return 'Venta';
  if (tipoInventario === 'INTERNAL') return 'Interno';
  return tipoInventario;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mapea un ProductoDTO a la fila de inventario (precioCompra ausente → 0). */
export function productoAInventarioRow(producto: ProductoDTO): ProductoInventarioRow {
  return {
    nombre: producto.nombre,
    marca: producto.marca ?? null,
    codigoBarras: producto.codigoBarras ?? null,
    color: producto.color ?? null,
    tamano: producto.tamano ?? null,
    tipoInventario: producto.tipoInventario,
    precioCompra: Number(producto.precioCompra ?? 0),
    precioVenta: Number(producto.precioVenta),
    margenGanancia: Number(producto.margenGanancia),
    cantidadStock: Number(producto.cantidadStock),
    stockMinimo: Number(producto.stockMinimo),
  };
}

@injectable()
export class ProductoExcelExportService {
  constructor(
    @inject('ListProductosUseCase')
    private readonly listUseCase: ListProductosUseCase,
  ) {}

  /**
   * Construye el workbook (2 hojas) a partir de las filas de inventario.
   * Puro (sin I/O): los tests inspeccionan las hojas directamente.
   */
  buildProductosWorkbook(rows: ProductoInventarioRow[]): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const productosSheet = workbook.addWorksheet('Productos');
    const totalesSheet = workbook.addWorksheet('Totales');

    // ── Hoja Productos: una fila por producto activo ──
    productosSheet.columns = PRODUCTOS_WIDTHS.map((width) => ({ width }));
    const header = productosSheet.addRow(PRODUCTOS_HEADER);
    header.eachCell((cell) => estiloHeader(cell));
    productosSheet.getRow(1).height = 20;

    for (const row of rows) {
      const valorCompra = round2(row.precioCompra * row.cantidadStock);
      const valorVenta = round2(row.precioVenta * row.cantidadStock);
      const dataRow = productosSheet.addRow([
        row.nombre,
        row.marca ?? '',
        row.codigoBarras ?? '',
        row.color ?? '',
        row.tamano ?? '',
        tipoLabel(row.tipoInventario),
        row.precioCompra,
        row.precioVenta,
        row.margenGanancia,
        row.cantidadStock,
        row.stockMinimo,
        valorCompra,
        valorVenta,
      ]);
      for (const col of PRODUCTOS_MONEY_COLS) {
        dataRow.getCell(col).numFmt = COP_FORMAT;
      }
      dataRow.getCell(9).numFmt = '0"%"';
    }

    // ── Hoja Totales: agregados de inventario ──
    totalesSheet.columns = TOTALES_WIDTHS.map((width) => ({ width }));
    const totalesHeader = totalesSheet.addRow(TOTALES_HEADER);
    totalesHeader.eachCell((cell) => estiloHeader(cell));
    totalesSheet.getRow(1).height = 20;

    const totalProductos = rows.length;
    const totalCompra = round2(
      rows.reduce((acc, r) => acc + r.precioCompra * r.cantidadStock, 0),
    );
    const totalVenta = round2(
      rows.reduce((acc, r) => acc + r.precioVenta * r.cantidadStock, 0),
    );

    const totalProductosRow = totalesSheet.addRow(['Total de productos', totalProductos]);
    totalProductosRow.getCell(2).numFmt = '0';
    totalesSheet.addRow(['Valor inventario a compra', totalCompra]).getCell(2).numFmt = COP_FORMAT;
    totalesSheet.addRow(['Valor inventario a venta', totalVenta]).getCell(2).numFmt = COP_FORMAT;

    return workbook;
  }

  /** Lista todos los productos activos del salón y serializa el workbook a Buffer. */
  async exportar(input: {
    salonId: number;
    userRol?: Rol;
  }): Promise<{ buffer: Buffer; filename: string }> {
    const result = await this.listUseCase.execute({
      salonId: input.salonId,
      limit: 0,
      userRol: input.userRol,
    });

    const productos = Array.isArray(result) ? result : result.data;
    const rows = productos.map(productoAInventarioRow);
    const workbook = this.buildProductosWorkbook(rows);
    // exceljs devuelve su propio Buffer (extends ArrayBuffer); convertirlo al
    // Buffer de Node para que Express pueda enviarlo como binario.
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `productos_${getColombiaDateString()}.xlsx`;

    return { buffer, filename };
  }
}
