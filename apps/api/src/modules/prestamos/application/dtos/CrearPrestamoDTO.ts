export interface CrearPrestamoInput {
  salonId: number;
  usuarioId?: number | null;
  nombreTercero?: string | null;
  monto: number;
  motivo?: string;
  registradoPorId: number;
}
