/**
 * Código de error que devuelve la API (regla de oro, PR2) cuando no hay caja
 * abierta para el salón: POST /registros y completar cita → 422 con
 * envelope { ok: false, data: null, error: { code: 'CAJA_CERRADA', ... } }.
 */
export const CAJA_CERRADA_CODE = 'CAJA_CERRADA';

/**
 * Detecta el error 422 CAJA_CERRADA que expone axios como
 * err.response.data.error.code. Usado por WalkInModal, AgendaPage y VentasPage
 * para mostrar el mensaje accionable y refrescar el CajaBanner sin cerrar el flujo.
 */
export function isCajaCerradaError(err: unknown): boolean {
  const e = err as { response?: { data?: { error?: { code?: string } } } };
  return e?.response?.data?.error?.code === CAJA_CERRADA_CODE;
}
