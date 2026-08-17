/* ── Extracción de mensajes de error de la API ── */

interface ApiErrorShape {
  response?: {
    data?: {
      message?: string;
      error?: { message?: string };
    };
  };
  message?: string;
}

/**
 * Extrae el mensaje de error del backend a partir de un error de axios/API.
 * Orden de preferencia (contrato del errorHandler del backend):
 *   1. err.response.data.error.message
 *   2. err.response.data.message
 *   3. err.message (Error genérico)
 *   4. fallback
 */
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const apiErr = err as ApiErrorShape;
    const serverMsg =
      apiErr.response?.data?.error?.message ?? apiErr.response?.data?.message;
    if (typeof serverMsg === 'string' && serverMsg.trim().length > 0) {
      return serverMsg;
    }
    if (typeof apiErr.message === 'string' && apiErr.message.trim().length > 0) {
      return apiErr.message;
    }
  }
  return fallback;
}
