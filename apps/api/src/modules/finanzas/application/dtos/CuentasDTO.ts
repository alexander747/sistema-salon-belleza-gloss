export type AntiguedadBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface CuentaCobrarDTO {
  clienteId: number;
  nombre: string;
  deudaTotal: number;
  cantidadRegistros: number;
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
}
