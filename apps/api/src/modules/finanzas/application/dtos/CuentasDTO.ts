export type AntiguedadBucket = '0-30' | '31-60' | '61-90' | '90+';

export type CuentaCobrarTipo = 'CLIENTE' | 'PRESTAMO';

/** Registro pendiente del cliente (desglose para el modal Cobrar/Abonar). */
export interface RegistroDeudaDTO {
  registroId: number;
  /** Fecha de negocio del registro; fallback a creadoEn para legacy. */
  fechaHora: Date;
  montoPendiente: number;
}

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
  /** Desglose por registro ordenado por fecha ASC (CLIENTE) | null (PRESTAMO) */
  registros: RegistroDeudaDTO[] | null;
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
