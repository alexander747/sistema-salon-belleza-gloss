import { describe, it, expect } from 'vitest';
import { extractApiErrorMessage } from './apiErrors';

describe('extractApiErrorMessage', () => {
  it('extrae error.message de la respuesta axios (contrato backend: { error: { message } })', () => {
    const err = {
      response: {
        status: 422,
        data: { ok: false, data: null, error: { code: 'CONFLICTO', message: 'Conflicto con cita existente' } },
      },
    };
    expect(extractApiErrorMessage(err, 'fallback')).toBe('Conflicto con cita existente');
  });

  it('cae a response.data.message cuando no hay error.message', () => {
    const err = { response: { status: 400, data: { message: 'Validación fallida' } } };
    expect(extractApiErrorMessage(err, 'fallback')).toBe('Validación fallida');
  });

  it('usa el fallback cuando response.data no tiene mensaje', () => {
    const err = { response: { status: 500, data: { ok: false } } };
    expect(extractApiErrorMessage(err, 'Error genérico')).toBe('Error genérico');
  });

  it('sin response usa err.message (Error estándar, ej. Network Error)', () => {
    const err = new Error('Network Error');
    expect(extractApiErrorMessage(err, 'Error de red')).toBe('Network Error');
  });

  it('usa el fallback para valores no-Error desconocidos', () => {
    expect(extractApiErrorMessage('oops', 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('usa el fallback cuando error.message está vacío', () => {
    const err = { response: { status: 422, data: { error: { code: 'X', message: '' } } } };
    expect(extractApiErrorMessage(err, 'fallback')).toBe('fallback');
  });
});
