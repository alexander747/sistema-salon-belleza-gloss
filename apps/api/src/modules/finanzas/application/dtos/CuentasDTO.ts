export type AntiguedadBucket = '0-30' | '31-60' | '61-90' | '90+';

export type CuentaCobrarTipo = 'CLIENTE' | 'PRESTAMO';

export interface CuentaCobrarDTO {
  /** clienteId (tipo CLIENTE) | prestamoId (tipo PRESTAMO) */
  id: number;
  tipo: CuentaCobrarTipo;
  nombre: string;
  deudaTotal: number;
  /** registros con deuda del cliente (CLIENTE) | null (PRESTAMO) */
  cantidadRegistros: number | null;
  antiguedadDias: number;
  antiguedadBucket: AntiguedadBucket;
}

export interface CuentaPagarDTO {
  empleadaId: number;
  nombre: string;
  sueldoFijo: number;
  porcentajeComisionServicio: number;
  pendienteActual: number;
  liquidadoAcumulado: number;
  /** true cuando la empleada no debe nada y tiene historial liquidado */
  alDia: boolean;
}
