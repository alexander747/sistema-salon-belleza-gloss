import type { MetodoPago } from '../../../../infrastructure/persistence/entities/MetodoPago';

export interface RegistrarPagoInput {
  prestamoId: number;
  monto: number;
  observacion?: string;
  tipoPago?: 'MANUAL' | 'LIQUIDACION';
  liquidacionId?: number | null;
  /** Cómo se pagó. Solo EFECTIVO entra al arqueo del día (Rule C, INFLOW). */
  metodoPago?: MetodoPago;
}
