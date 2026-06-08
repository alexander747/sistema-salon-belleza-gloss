export interface PagoPrestamoDTO {
  id: number;
  prestamoId: number;
  monto: number;
  fechaPago: string;
  tipoPago: string;
  liquidacionId: number | null;
  observacion: string | null;
  creadoEn: string;
}
