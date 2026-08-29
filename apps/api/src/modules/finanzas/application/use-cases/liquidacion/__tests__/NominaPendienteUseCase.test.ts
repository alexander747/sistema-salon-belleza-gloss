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
        sueldoFijoMensual: 0,
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
        sueldoFijoMensual: 200000,
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
    expect(result[0]).toEqual(expect.objectContaining({ nombre: 'Rosa', totalAPagar: 400000, sueldoFijoMensual: 400000 }));
    expect(result[1]).toEqual(expect.objectContaining({ nombre: 'Gloria', totalAPagar: 800000, sueldoFijoMensual: 800000 }));
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
      expect.objectContaining({ nombre: 'Mar', sueldoFijo: 2500000, sueldoFijoMensual: 2500000, totalAPagar: 2500000 }),
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
      expect.objectContaining({ nombre: 'Nueva', totalComisionesPendientes: 30000, cantidadRegistros: 1, sueldoFijoMensual: 200000 }),
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
        sueldoFijoMensual: 200000,
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
        sueldoFijoMensual: 200000,
        bonoHorario: 25000, // 50% de 50000
        totalAPagar: 125000,
        cantidadRegistros: 0,
        frecuenciaPago: 'QUINCENAL',
      }),
    );
  });

  it('QUINCENAL con backfill: el período filtra por fechaHora (no creadoEn)', async () => {
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z')); // 07:00 COT = 10/08 → quincena [1,15]
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 30,
        nombre: 'B1',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 0,
      }),
    ]);
    // Registro backfilleado: fecha de negocio 05/08, pero CREADO el 22/08 (creadoEn fuera de la quincena)
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({
        id: 31,
        usuarioId: 30,
        comisionCalculada: 12000,
        fechaHora: new Date('2026-08-05T10:00:00'),
        creadoEn: new Date('2026-08-22T10:00:00'),
      }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'B1',
        totalComisionesPendientes: 12000, // cuenta en la quincena del 05/08 (fechaHora), no por creadoEn
        cantidadRegistros: 1,
      }),
    );
  });

  it('QUINCENAL con backfill: el guard anti-doble-pago SIGUE comparando contra creadoEn', async () => {
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z')); // 07:00 COT = 10/08 → quincena [1,15]
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 31,
        nombre: 'B2',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 0,
      }),
    ]);
    // Registro con fechaHora 05/08 (en la quincena) creado el 22/08 (DESPUÉS de la última liquidación 10/08)
    // → el guard lo MANTIENE porque creadoEn (22/08) > liquidación (10/08) — semántica de auditoría.
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({
        id: 32,
        usuarioId: 31,
        comisionCalculada: 8000,
        fechaHora: new Date('2026-08-05T10:00:00'),
        creadoEn: new Date('2026-08-22T10:00:00'),
      }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([
      { id: 40, creadoEn: new Date('2026-08-10T10:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'B2',
        totalComisionesPendientes: 8000,
        cantidadRegistros: 1,
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
        sueldoFijoMensual: 200000,
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
        sueldoFijoMensual: 200000,
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

describe('NominaPendienteUseCase — frecuencia SEMANAL', () => {
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

  it('SEMANAL jueves 13/08: período [lunes 10, domingo 16] y comp fijo al 25% (totalAPagar=62500)', async () => {
    vi.setSystemTime(new Date('2026-08-13T12:00:00Z')); // 07:00 COT = jueves 13/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 10,
        nombre: 'S1',
        frecuenciaPago: 'SEMANAL',
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
        nombre: 'S1',
        totalComisionesPendientes: 0,
        totalPropinas: 0,
        sueldoFijo: 50000, // 25% de 200000
        sueldoFijoMensual: 200000,
        bonoHorario: 12500, // 25% de 50000
        totalAPagar: 62500,
        cantidadRegistros: 0,
        periodoInicio: colombiaDayStartUTC('2026-08-10'),
        periodoFin: colombiaDayEndUTC('2026-08-16'),
        frecuenciaPago: 'SEMANAL',
      }),
    );
  });

  it('SEMANAL filtra registros fuera de la semana y el guard consulta la semana actual', async () => {
    vi.setSystemTime(new Date('2026-08-13T12:00:00Z')); // 07:00 COT = jueves 13/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 10,
        nombre: 'S1',
        frecuenciaPago: 'SEMANAL',
        sueldoFijo: 200000,
        bonoHorario: 50000,
      }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 1, usuarioId: 10, comisionCalculada: 30000, propina: 5000, creadoEn: new Date('2026-08-11T10:00:00') }), // lunes, dentro
      makeRegistro({ id: 2, usuarioId: 10, comisionCalculada: 20000, creadoEn: new Date('2026-08-19T10:00:00') }), // miércoles siguiente, fuera
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        totalComisionesPendientes: 30000, // el registro del 19/08 queda fuera de la semana
        totalPropinas: 5000,
        sueldoFijoMensual: 200000,
        cantidadRegistros: 1,
        totalAPagar: 97500, // 30000 + 5000 + 50000 + 12500
      }),
    );
    expect(mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo).toHaveBeenCalledWith(
      1,
      10,
      colombiaDayStartUTC('2026-08-10'),
      colombiaDayEndUTC('2026-08-16'),
    );
  });

  it('SEMANAL lunes 17/08: período [17, domingo 23] (inicio de semana = hoy)', async () => {
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z')); // 07:00 COT = lunes 17/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 11,
        nombre: 'S2',
        frecuenciaPago: 'SEMANAL',
        sueldoFijo: 200000,
      }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'S2',
        sueldoFijo: 50000, // 25% de 200000
        sueldoFijoMensual: 200000,
        totalAPagar: 50000,
        periodoInicio: colombiaDayStartUTC('2026-08-17'),
        periodoFin: colombiaDayEndUTC('2026-08-23'),
        frecuenciaPago: 'SEMANAL',
      }),
    );
  });

  it('SEMANAL liquidada esta semana sin registros nuevos: no aparece en pendientes', async () => {
    vi.setSystemTime(new Date('2026-08-13T12:00:00Z')); // 07:00 COT = jueves 13/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 12,
        nombre: 'S3',
        frecuenciaPago: 'SEMANAL',
        sueldoFijo: 200000,
      }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([
      { id: 30, creadoEn: new Date('2026-08-12T10:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(0);
    // El guard anti-doble-pago consulta la SEMANA actual, no el mes global
    expect(mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo).toHaveBeenCalledWith(
      1,
      12,
      colombiaDayStartUTC('2026-08-10'),
      colombiaDayEndUTC('2026-08-16'),
    );
  });

  it('SEMANAL con registros pendientes de la semana ANTERIOR (sin liquidar): aparece con el rango real (regla dueño)', async () => {
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z')); // 07:00 COT = viernes 28/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 13,
        nombre: 'S4',
        frecuenciaPago: 'SEMANAL',
      }),
    ]);
    // Registros de la semana pasada 17-23/08, NO liquidados; la semana vigente es 24-30/08
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 1, usuarioId: 13, comisionCalculada: 422500, creadoEn: new Date('2026-08-18T10:00:00'), fechaHora: new Date('2026-08-18T10:00:00') }),
      makeRegistro({ id: 2, usuarioId: 13, comisionCalculada: 50000, creadoEn: new Date('2026-08-22T10:00:00'), fechaHora: new Date('2026-08-22T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'S4',
        totalComisionesPendientes: 472500, // 422500 + 50000 — los registros atrasados SÍ aparecen
        cantidadRegistros: 2,
        // El período mostrado es el rango real de los registros (semana pasada),
        // no la semana vigente vacía
        periodoInicio: colombiaDayStartUTC('2026-08-18'),
        periodoFin: colombiaDayEndUTC('2026-08-22'),
      }),
    );
  });
});
