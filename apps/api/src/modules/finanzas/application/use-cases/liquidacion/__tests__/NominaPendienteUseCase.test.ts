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
  findBySalonAndEmpleada: vi.fn(),
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
    // Freeze the clock at 15/08/2026 (07:00 COT). Fixtures live in August and the
    // MENSUAL salary is prorated by days of month ([01/08 → today]), so without a
    // frozen clock the expectations depended on the real execution date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    useCase = new NominaPendienteUseCase(
      mockUsuarioRepo as never,
      mockRegistroRepo as never,
      mockLiquidacionRepo as never,
    );
    // Default: sin historial de liquidaciones → el sueldo fijo cuenta 1 período
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
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
        // Prorrateo MENSUAL por días: [01/08 → 15/08] = 15/31
        bonoHorario: 24194, // 50.000 × 15/31
        sueldoFijo: 96774, // 200.000 × 15/31
        sueldoFijoMensual: 200000,
        totalAPagar: 120968, // 96.774 + 24.194
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
    // Prorrateo MENSUAL por días: [01/08 → 15/08] = 15/31
    expect(result[0]).toEqual(expect.objectContaining({ nombre: 'Rosa', totalAPagar: 193548, sueldoFijoMensual: 400000 })); // 400.000 × 15/31
    expect(result[1]).toEqual(expect.objectContaining({ nombre: 'Gloria', totalAPagar: 387097, sueldoFijoMensual: 800000 })); // 800.000 × 15/31
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
      expect.objectContaining({
        nombre: 'Mar',
        // Prorrateo MENSUAL por días: [01/08 → 15/08] = 15/31 → 2.500.000 × 15/31
        sueldoFijo: 1209677,
        sueldoFijoMensual: 2500000,
        totalAPagar: 1209677,
      }),
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
    // Última liquidación cubre todo el período → no quedan registros nuevos
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([
      { id: 10, fechaHasta: new Date('2026-08-31T05:00:00.000Z'), creadoEn: new Date('2026-08-10T10:00:00') },
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
    // Última liquidación cubre hasta fin de julio → el registro del 15/08 (agosto) es nuevo
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([
      { id: 11, fechaHasta: new Date('2026-07-31T05:00:00.000Z'), creadoEn: new Date('2026-07-31T12:00:00') },
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
    // Aísla cada test: sin historial de liquidaciones salvo que el test lo defina.
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('QUINCENAL: una fila por quincena — el registro del 20/08 cae en su propia fila (16-31)', async () => {    vi.setSystemTime(new Date('2026-08-10T12:00:00Z')); // 07:00 COT = 10/08
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
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    // Una fila por quincena: 1-15 (registro 05/08) y 16-31 (registro 20/08)
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'Q1',
        totalComisionesPendientes: 10000,
        totalPropinas: 2000,
        // Prorrateo por días: 200.000 × 15/31 (agosto tiene 31 días)
        sueldoFijo: 96774,
        bonoHorario: 24194,
        cantidadRegistros: 1,
        periodoInicio: colombiaDayStartUTC('2026-08-01'),
        periodoFin: colombiaDayEndUTC('2026-08-15'),
        frecuenciaPago: 'QUINCENAL',
      }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        nombre: 'Q1',
        totalComisionesPendientes: 30000,
        cantidadRegistros: 1,
        periodoInicio: colombiaDayStartUTC('2026-08-16'),
        frecuenciaPago: 'QUINCENAL',
      }),
    );
  });

  it('QUINCENAL sin registros: paga el comp fijo prorrateado por días (quincena 15/31)', async () => {
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
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'Q0',
        totalComisionesPendientes: 0,
        totalPropinas: 0,
        // Prorrateo por días: 200.000 × 15/31 = 96.774
        sueldoFijo: 96774,
        sueldoFijoMensual: 200000,
        bonoHorario: 24194, // 50.000 × 15/31
        totalAPagar: 120968,
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

  it('QUINCENAL con backfill ya cubierto: el guard anti-doble-pago usa la fecha de negocio (fechaHora), no creadoEn', async () => {
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z')); // 07:00 COT = 25/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 33,
        nombre: 'B3',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 0,
      }),
    ]);
    // Backfill: fecha de negocio 05/08 (dentro de la quincena [1,15] ya cubierta
    // por la liquidación del 10/08), pero creadoEn 22/08 (posterior a la liquidación).
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({
        id: 34,
        usuarioId: 33,
        comisionCalculada: 8000,
        fechaHora: new Date('2026-08-05T10:00:00'),
        creadoEn: new Date('2026-08-22T10:00:00'),
      }),
    ]);
    // Liquidación sin fechaHasta → fin = creadoEn (10/08). El período [1,15] sigue
    // en la lista (cursor 11/08), por lo que sin el fix el backfill se pagaría otra vez.
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([
      { id: 40, creadoEn: new Date('2026-08-10T10:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    // El guard usa fechaHora (05/08 ≤ 10/08) → excluido: no queda nada liquidable
    expect(result).toHaveLength(0);
  });

  it('QUINCENAL con backfill posterior a la liquidación: sí se liquida', async () => {
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z')); // 07:00 COT = 25/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 34,
        nombre: 'B4',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 0,
      }),
    ]);
    // Fecha de negocio 20/08 (posterior a la liquidación del 10/08) → liquidable.
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({
        id: 35,
        usuarioId: 34,
        comisionCalculada: 9000,
        fechaHora: new Date('2026-08-20T10:00:00'),
        creadoEn: new Date('2026-08-24T10:00:00'),
      }),
    ]);
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([
      { id: 41, creadoEn: new Date('2026-08-10T10:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'B4',
        totalComisionesPendientes: 9000,
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

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'Q2',
        totalComisionesPendientes: 40000,
        // Prorrateo por días: 200.000 × 16/31 (quincena 16-31 de agosto, 31 días)
        sueldoFijo: 103226,
        sueldoFijoMensual: 200000,
        totalAPagar: 143226,
        periodoInicio: colombiaDayStartUTC('2026-08-16'),
        periodoFin: colombiaDayEndUTC('2026-08-31'),
        frecuenciaPago: 'QUINCENAL',
      }),
    );
  });

  it('MENSUAL: registros de períodos anteriores sin liquidar aparecen en su propia fila', async () => {
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
    // Registro del mes ANTERIOR (julio) sin liquidar → fila de julio
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({ id: 4, usuarioId: 3, comisionCalculada: 15000, creadoEn: new Date('2026-07-25T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'M1',
        totalComisionesPendientes: 15000,
        sueldoFijo: 200000, // 100%
        sueldoFijoMensual: 200000,
        bonoHorario: 50000,
        totalAPagar: 265000,
        cantidadRegistros: 1,
        // El registro es de julio → su fila es el período de julio
        periodoInicio: colombiaDayStartUTC('2026-07-01'),
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

  it('SEMANAL jueves 13/08: período [lunes 10, domingo 16] y comp fijo prorrateado por días', async () => {
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
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'S1',
        totalComisionesPendientes: 0,
        totalPropinas: 0,
        // Prorrateo por días: 200.000 × 7/31 (semana 10-16 de agosto, 31 días)
        sueldoFijo: 45161,
        sueldoFijoMensual: 200000,
        bonoHorario: 11290, // 50.000 × 7/31
        totalAPagar: 56451,
        cantidadRegistros: 0,
        periodoInicio: colombiaDayStartUTC('2026-08-10'),
        periodoFin: colombiaDayEndUTC('2026-08-16'),
        frecuenciaPago: 'SEMANAL',
      }),
    );
  });

  it('SEMANAL: una fila por semana — el registro del 19/08 cae en su propia semana', async () => {
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
      makeRegistro({ id: 1, usuarioId: 10, comisionCalculada: 30000, propina: 5000, creadoEn: new Date('2026-08-11T10:00:00') }), // lunes 10-16
      makeRegistro({ id: 2, usuarioId: 10, comisionCalculada: 20000, creadoEn: new Date('2026-08-19T10:00:00') }), // semana 17-23
    ]);
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    // Una fila por semana: 10-16 (reg 1) y 17-23 (reg 2)
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        totalComisionesPendientes: 30000,
        totalPropinas: 5000,
        cantidadRegistros: 1,
        periodoInicio: colombiaDayStartUTC('2026-08-10'),
        periodoFin: colombiaDayEndUTC('2026-08-16'),
      }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        totalComisionesPendientes: 20000,
        cantidadRegistros: 1,
        periodoInicio: colombiaDayStartUTC('2026-08-17'),
        periodoFin: colombiaDayEndUTC('2026-08-23'),
      }),
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
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'S2',
        // Prorrateo por días: 200.000 × 7/31
        sueldoFijo: 45161,
        sueldoFijoMensual: 200000,
        totalAPagar: 45161,
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
    // Última liquidación cubre toda la semana actual → nada pendiente
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([
      { id: 30, fechaHasta: new Date('2026-08-16T05:00:00.000Z'), creadoEn: new Date('2026-08-12T10:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(0);
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

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'S4',
        totalComisionesPendientes: 472500, // 422500 + 50000 — los registros atrasados SÍ aparecen
        cantidadRegistros: 2,
        // Ambos registros caen en la misma semana 17-23 → una sola fila con ese período
        periodoInicio: colombiaDayStartUTC('2026-08-17'),
        periodoFin: colombiaDayEndUTC('2026-08-23'),
      }),
    );
  });

  it('MENSUAL sin historial de pagos: sueldo fijo del período vigente prorrateado por días', async () => {
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z')); // 07:00 COT = 28/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 14, nombre: 'M1', frecuenciaPago: 'MENSUAL', sueldoFijo: 600000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result[0]).toEqual(
      expect.objectContaining({
        nombre: 'M1',
        // Período vigente [01/08, hoy 28/08] = 28 días de 31 → 600.000 × 28/31
        sueldoFijo: 541935,
        sueldoFijoMensual: 600000,
      }),
    );
  });

  it('MENSUAL con última liquidación hace 2 meses: sueldo fijo se ACUMULA × 3 (regla dueño)', async () => {
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z')); // 07:00 COT = 28/08
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 15, nombre: 'M2', frecuenciaPago: 'MENSUAL', sueldoFijo: 600000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([]);
    // Última liquidación pagada hasta 31/05 → junio, julio y agosto vencidos
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([
      { id: 40, fechaHasta: new Date('2026-05-31T05:00:00.000Z'), creadoEn: new Date('2026-05-31T12:00:00') },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    // UNA FILA POR MES: junio, julio y agosto, cada uno con su sueldo de 600.000
    expect(result).toHaveLength(3);
    result.forEach((fila) => {
      expect(fila.nombre).toBe('M2');
      expect(fila.sueldoFijo).toBe(600000); // cada mes su propio sueldo
      expect(fila.sueldoFijoMensual).toBe(600000);
    });
    expect(result.map((f) => f.periodoInicio.getUTCMonth())).toEqual([5, 6, 7]); // jun, jul, ago
  });
});

describe('NominaPendienteUseCase — insumos del período (informativo, PR3)', () => {
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

  it('fixture lucía: insumo del período = 84000 y NO se resta otra vez de totalAPagar', async () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z')); // 07:00 COT = 10/09
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 1, nombre: 'Lucía', frecuenciaPago: 'MENSUAL', sueldoFijo: 0 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({
        id: 189,
        usuarioId: 1,
        comisionCalculada: 267600, // comisión YA neteada de insumos
        propina: 0,
        creadoEn: new Date('2026-09-05T10:00:00'),
        // item fixture: 105 g × $800 = 84000 de costo base de insumos
        serviciosItems: [{ costoBaseInsumos: 84000 }],
      }),
    ]);
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].totalCostoBaseInsumos).toBe(84000);
    // Reconciliación: el insumo es informativo, la comisión no se toca.
    expect(result[0].totalComisionesPendientes).toBe(267600);
    expect(result[0].totalAPagar).toBe(267600);
  });

  it('ANULADO y registros sin items → insumo 0 (no se omite la fila)', async () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 3, nombre: 'Vacía', frecuenciaPago: 'MENSUAL', sueldoFijo: 200000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({
        id: 1,
        usuarioId: 3,
        estado: 'ANULADO',
        comisionCalculada: 0,
        creadoEn: new Date('2026-09-05T10:00:00'),
        serviciosItems: [{ costoBaseInsumos: 84000 }],
      }),
      makeRegistro({
        id: 2,
        usuarioId: 3,
        estado: 'ACTIVO',
        comisionCalculada: 0,
        creadoEn: new Date('2026-09-06T10:00:00'),
        // sin serviciosItems → se trata como []
      }),
    ]);
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].totalCostoBaseInsumos).toBe(0);
  });

  it('cada fila de período solo suma los insumos de su propio delPeriodo', async () => {
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z')); // 07:00 COT = 10/08 → quincena [1,15]
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({
        id: 20,
        nombre: 'Q-insumos',
        frecuenciaPago: 'QUINCENAL',
        sueldoFijo: 200000,
      }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      // Quincena de julio [16,31]: item 50000
      makeRegistro({
        id: 1,
        usuarioId: 20,
        comisionCalculada: 0,
        creadoEn: new Date('2026-07-20T10:00:00'),
        serviciosItems: [{ costoBaseInsumos: 50000 }],
      }),
      // Quincena de agosto [1,15]: item 84000
      makeRegistro({
        id: 2,
        usuarioId: 20,
        comisionCalculada: 267600,
        creadoEn: new Date('2026-08-05T10:00:00'),
        serviciosItems: [{ costoBaseInsumos: 84000 }],
      }),
    ]);
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0].totalCostoBaseInsumos).toBe(50000); // julio
    expect(result[1].totalCostoBaseInsumos).toBe(84000); // agosto
  });

  it('un registro fuera del delPeriodo (item 50000) NO suma al insumo', async () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z')); // período vigente: septiembre
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeEmpleada({ id: 21, nombre: 'Fuera', frecuenciaPago: 'MENSUAL', sueldoFijo: 200000 }),
    ]);
    mockRegistroRepo.findBySalon.mockResolvedValue([
      makeRegistro({
        id: 1,
        usuarioId: 21,
        comisionCalculada: 267600,
        creadoEn: new Date('2026-09-05T10:00:00'),
        serviciosItems: [{ costoBaseInsumos: 84000 }],
      }),
      // Agosto: cubierto por la última liquidación → fuera del período vigente
      makeRegistro({
        id: 2,
        usuarioId: 21,
        comisionCalculada: 0,
        creadoEn: new Date('2026-08-20T10:00:00'),
        serviciosItems: [{ costoBaseInsumos: 50000 }],
      }),
    ]);
    // Última liquidación hasta fin de agosto → solo septiembre queda pendiente
    mockLiquidacionRepo.findBySalonAndEmpleada.mockResolvedValue([
      {
        id: 50,
        fechaHasta: new Date('2026-08-31T05:00:00.000Z'),
        creadoEn: new Date('2026-08-31T12:00:00'),
      },
    ]);

    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].totalCostoBaseInsumos).toBe(84000);
  });
});
