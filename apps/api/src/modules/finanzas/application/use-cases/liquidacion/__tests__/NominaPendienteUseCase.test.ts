import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Rol } from '@pos-final/types';
import { NominaPendienteUseCase } from '../NominaPendienteUseCase';
import {
  colombiaDayStartUTC,
  colombiaDayEndUTC,
} from '../../../../../../shared/colombia-date';

// ── Fakes ─────────────────────────────────────────────────────
const mockUsuarioRepo = {
  findBySalon: vi.fn(),
};
const mockRegistroRepo = {
  findBySalon: vi.fn(),
};
const mockLiquidacionRepo = {
  findBySalonEmpleadaAndPeriodo: vi.fn(),
};

const makeEmpleada = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  nombre: 'Ana',
  email: 'ana@test.com',
  numeroWhatsApp: '3000000000',
  rol: Rol.MANICURISTA,
  sueldoFijo: 0,
  bonoHorario: 0,
  porcentajeComisionServicio: 0,
  frecuenciaPago: 'MENSUAL',
  activo: true,
  ...overrides,
});

const makeRegistro = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  salonId: 1,
  usuarioId: 1,
  clienteId: 1,
  estado: 'ACTIVO',
  estaPagadaEmpleada: false,
  comisionCalculada: 0,
  propina: 0,
  creadoEn: new Date('2026-08-01T10:00:00'),
  ...overrides,
});

describe('NominaPendienteUseCase', () => {
  let useCase: NominaPendienteUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new NominaPendienteUseCase(
      mockUsuarioRepo as never,
      mockRegistroRepo as never,
      mockLiquidacionRepo as never,
    );
  });

  it('busca todos los roles activos del salón (rol omitido en findBySalon)', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([makeEmpleada({ sueldoFijo: 100000 })]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    await useCase.execute({ salonId: 1 });

    expect(mockUsuarioRepo.findBySalon).toHaveBeenCalledWith(1, undefined, true);
  });

  it('incluye una manicurista con registros pendientes y calcula totalAPagar', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 1, nombre: 'Ana', rol: Rol.MANICURISTA }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 1, usuarioId: 1, comisionCalculada: 30000, propina: 5000 }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        empleadaId: 1,
        nombre: 'Ana',
        totalComisionesPendientes: 30000,
        totalPropinas: 5000,
        bonoHorario: 0,
        sueldoFijo: 0,
        totalAPagar: 35000,
        cantidadRegistros: 1,
      }),
    );
  });

  it('incluye empleada con solo sueldo fijo (0 registros pendientes)', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 2, nombre: 'Luz', sueldoFijo: 200000, bonoHorario: 50000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        empleadaId: 2,
        nombre: 'Luz',
        totalComisionesPendientes: 0,
        totalPropinas: 0,
        bonoHorario: 50000,
        sueldoFijo: 200000,
        totalAPagar: 250000,
        cantidadRegistros: 0,
      }),
    );
  });

  it('excluye al CONTADOR aunque tenga registros pendientes y sueldo fijo', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 3, nombre: 'Caro', rol: Rol.CONTADOR, sueldoFijo: 600000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 1, usuarioId: 3, comisionCalculada: 10000 }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(0);
  });

  it('incluye recepcionista y administrador con sueldo fijo y 0 registros', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 4, nombre: 'Rosa', rol: Rol.RECEPCIONISTA, sueldoFijo: 400000 }),
      makeEmpleada({ id: 5, nombre: 'Gloria', rol: Rol.ADMINISTRADOR, sueldoFijo: 800000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({ nombre: 'Rosa', totalAPagar: 400000 }));
    expect(result[1]).toEqual(expect.objectContaining({ nombre: 'Gloria', totalAPagar: 800000 }));
  });

  it('incluye a la DUEÑA cuando tiene configuración de pago', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 6, nombre: 'Mar', rol: Rol.DUEÑA, sueldoFijo: 2500000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ nombre: 'Mar', sueldoFijo: 2500000, totalAPagar: 2500000 }),
    );
  });

  it('excluye a la DUEÑA sin configuración ni registros', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 7, nombre: 'Fantasma', rol: Rol.DUEÑA, sueldoFijo: 0, bonoHorario: 0 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(0);
    expect(mockUsuarioRepo.findBySalon).toHaveBeenCalledWith(1, undefined, true);
  });

  it('excluye empleada ya liquidada en el período sin registros nuevos', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 8, nombre: 'Vieja', sueldoFijo: 200000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 1, usuarioId: 8, comisionCalculada: 30000, creadoEn: new Date('2026-08-01T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([
      { id: 10, creadoEn: new Date('2026-08-10T10:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(0);
  });

  it('incluye empleada con registros NUEVOS posteriores a la última liquidación', async () => {
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 9, nombre: 'Nueva', sueldoFijo: 200000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 1, usuarioId: 9, comisionCalculada: 30000, creadoEn: new Date('2026-08-15T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([
      { id: 11, creadoEn: new Date('2026-08-10T10:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ nombre: 'Nueva', totalComisionesPendientes: 30000, cantidadRegistros: 1 }),
    );
  });
});

describe('NominaPendienteUseCase — período por frecuenciaPago', () => {
  let useCase: NominaPendienteUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useCase = new NominaPendienteUseCase(
      mockUsuarioRepo as never,
      mockRegistroRepo as never,
      mockLiquidacionRepo as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('QUINCENAL día 10: período [1,15], comp fijo al 50% y registros filtrados por quincena', async () => {    vi.setSystemTime(new Date('2026-08-10T12:00:00Z')); // 07:00 COT = 10/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 1,
        nombre: 'Q1',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 200000,
        bonoHorario: 50000,
      }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 1, usuarioId: 1, comisionCalculada: 10000, propina: 2000, creadoEn: new Date('2026-08-05T10:00:00') }),
      makeRegistro({ id: 2, usuarioId: 1, comisionCalculada: 30000, creadoEn: new Date('2026-08-20T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'Q1',
        totalComisionesPendientes: 10000, // el registro del 20/08 queda fuera de la quincena 1-15
        totalPropinas: 2000,
        sueldoFijo: 100000, // 50% de 200000
        bonoHorario: 25000, // 50% de 50000
        totalAPagar: 137000, // 10000 + 2000 + 100000 + 25000
        cantidadRegistros: 1,
        periodoInicio: colombiaDayStartUTC('2026-08-01'),
        periodoFin: colombiaDayEndUTC('2026-08-15'),
        frecuenciaPago: 'QUINCENAL',
      }),
    );
    // El guard anti-doble-pago consulta el período de la empleada, no el mes global
    expect(mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo).toHaveBeenCalledWith(
      1,
      1,
      colombiaDayStartUTC('2026-08-01'),
      colombiaDayEndUTC('2026-08-15'),
    );
  });

  it('QUINCENAL sin registros: paga el 50% del comp fijo (totalAPagar=125000)', async () => {
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z')); // 07:00 COT = 10/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 4,
        nombre: 'Q0',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 200000,
        bonoHorario: 50000,
      }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'Q0',
        totalComisionesPendientes: 0,
        totalPropinas: 0,
        sueldoFijo: 100000, // 50% de 200000
        bonoHorario: 25000, // 50% de 50000
        totalAPagar: 125000,
        cantidadRegistros: 0,
        frecuenciaPago: 'QUINCENAL',
      }),
    );
  });

  it('QUINCENAL día 20: período [16, último día del mes] y comp fijo al 50%', async () => {
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z')); // 07:00 COT = 20/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 2,
        nombre: 'Q2',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 200000,
      }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 3, usuarioId: 2, comisionCalculada: 40000, creadoEn: new Date('2026-08-18T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'Q2',
        totalComisionesPendientes: 40000,
        sueldoFijo: 100000, // 50% de 200000
        totalAPagar: 140000,
        periodoInicio: colombiaDayStartUTC('2026-08-16'),
        periodoFin: colombiaDayEndUTC('2026-08-31'),
        frecuenciaPago: 'QUINCENAL',
      }),
    );
    expect(mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo).toHaveBeenCalledWith(
      1,
      2,
      colombiaDayStartUTC('2026-08-16'),
      colombiaDayEndUTC('2026-08-31'),
    );
  });

  it('MENSUAL día 10: período [1, hoy], comp fijo al 100% y registros NO filtrados por período', async () => {
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z')); // 07:00 COT = 10/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 3,
        nombre: 'M1',
        frecuenciaPago: 'MENSUAL',
        sueldoFijo: 200000,
        bonoHorario: 50000,
      }),
    ]);
    // Registro del mes ANTERIOR: para MENSUAL sigue contando (comportamiento actual)
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 4, usuarioId: 3, comisionCalculada: 15000, creadoEn: new Date('2026-07-25T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'M1',
        totalComisionesPendientes: 15000,
        sueldoFijo: 200000, // 100% — sin cambios
        bonoHorario: 50000,
        totalAPagar: 265000, // 15000 + 200000 + 50000
        cantidadRegistros: 1, // el registro viejo NO se filtra
        periodoInicio: colombiaDayStartUTC('2026-08-01'),
        periodoFin: colombiaDayEndUTC('2026-08-10'),
        frecuenciaPago: 'MENSUAL',
      }),
    );
  });
});
