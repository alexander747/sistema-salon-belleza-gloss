import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { verificarCajaAbierta } from '../verificarCajaAbierta';
import { CajaCerradaError } from '../../../../../shared/errors';

const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
};

describe('verificarCajaAbierta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should lanzar CajaCerradaError cuando no hay caja ABIERTA', async () => {
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
});
