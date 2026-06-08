export interface PrestamoDTO {
  id: number;
  salonId: number;
  usuarioId: number | null;
  nombreEmpleado: string | null;
  nombreTercero: string | null;
  monto: number;
  saldoPendiente: number;
  motivo: string | null;
  estado: string;
  fechaCreacion: string;
  creadoEn: string;
  actualizadoEn: string;
}
