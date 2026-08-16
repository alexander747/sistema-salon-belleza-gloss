import { describe, it, expect } from 'vitest';
import { isCajaCerradaError } from '../cajaError';

/**
 * Envelope de error de la API (PR1): { ok: false, data: null, error: { code, message, details } }.
 * axios lo expone como err.response.data.error.code.
 */
function apiError(code: string): unknown {
  return {
    response: {
      status: code === 'CAJA_CERRADA' ? 422 : 500,
      data: { ok: false, data: null, error: { code, message: 'mensaje' } },
    },
  };
}

describe('isCajaCerradaError', () => {
  it('devuelve true para el error 422 CAJA_CERRADA (envelope de la API)', () => {
    expect(isCajaCerradaError(apiError('CAJA_CERRADA'))).toBe(true);
  });

  it('devuelve false para otros códigos de error de caja', () => {
    expect(isCajaCerradaError(apiError('CAJA_YA_CERRADA'))).toBe(false);
    expect(isCajaCerradaError(apiError('CAJA_NO_ABIERTA'))).toBe(false);
    expect(isCajaCerradaError(apiError('VALIDATION_ERROR'))).toBe(false);
  });

  it('devuelve false para errores de red sin response (axios no responde)', () => {
    expect(isCajaCerradaError(new Error('Network Error'))).toBe(false);
    expect(isCajaCerradaError({ request: {} })).toBe(false);
  });

  it('devuelve false para valores no-axios (null, undefined, string, objeto vacío)', () => {
    expect(isCajaCerradaError(null)).toBe(false);
    expect(isCajaCerradaError(undefined)).toBe(false);
    expect(isCajaCerradaError('CAJA_CERRADA')).toBe(false);
    expect(isCajaCerradaError({})).toBe(false);
  });
});
