import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { verificarCajaAbierta } from '../verificarCajaAbierta';
import { CajaCerradaError, CajaNoAbiertaEnFechaError } from '../../../../../shared/errors';
import { getColombiaDateString } from '../../../../../shared/colombia-date';

const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
};

describe('verificarCajaAbierta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should lanzar CajaCerradaError cuando no hay caja ABIERTA (hoy)', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    await expect(verificarCajaAbierta(mockCajaRepo as never, 1)).rejects.toThrow(CajaCerradaError);
  });

  it('should devolver la caja cuando hay una ABIERTA', async () => {
    const caja = { id: 5, salonId: 1, estado: 'ABIERTA' };
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(caja);

    const result = await verificarCajaAbierta(mockCajaRepo as never, 1);

    expect(result).toBe(caja);
    expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  describe('fecha explícita (backfill)', () => {
    it('should resolver la caja por la fecha pasada al guard', async () => {
      const caja = { id: 5, salonId: 1, estado: 'ABIERTA', fechaCaja: '2026-08-16' };
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(caja);

      const result = await verificarCajaAbierta(mockCajaRepo as never, 1, '2026-08-16');

      expect(result).toBe(caja);
      expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, '2026-08-16');
    });

    it('should lanzar CajaNoAbiertaEnFechaError (409) sin caja ABIERTA para la fecha pasada', async () => {
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

      await expect(
        verificarCajaAbierta(mockCajaRepo as never, 1, '2026-08-16'),
      ).rejects.toThrow(CajaNoAbiertaEnFechaError);
    });

    it('should mantener CajaCerradaError (422) cuando la fecha explícita es hoy', async () => {
      // fecha explícita == hoy (misma referencia que el guard) → camino de hoy intacto
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

      await expect(
        verificarCajaAbierta(mockCajaRepo as never, 1, getColombiaDateString()),
      ).rejects.toThrow(CajaCerradaError);
    });
  });
});
