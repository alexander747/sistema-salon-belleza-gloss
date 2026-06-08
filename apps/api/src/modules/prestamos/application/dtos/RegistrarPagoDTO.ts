export interface RegistrarPagoInput {
  prestamoId: number;
  monto: number;
  observacion?: string;
  tipoPago?: 'MANUAL' | 'LIQUIDACION';
  liquidacionId?: number | null;
}
