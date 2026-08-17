import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost, mockPut, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut, patch: mockPatch },
}));

import EmpleadasPage from '../EmpleadasPage';

const duena: IUser = {
  id: 2,
  nombre: 'Dueña Test',
  numeroWhatsApp: '',
  email: 'duena@test.com',
  rol: Rol.DUEÑA,
  salonId: 1,
  porcentajeComisionServicio: 0,
  sueldoFijo: 0,
  bonoHorario: 0,
  activo: true,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

function defaultApiMock(empleadas: unknown[] = []) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/empleadas')) return Promise.resolve({ data: empleadas });
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/empleadas']}>
      <EmpleadasPage />
    </MemoryRouter>,
  );
}

async function openCreateModal() {
  fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo empleado' }));
  fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
    target: { value: 'Marta' },
  });
  fireEvent.change(screen.getByPlaceholderText('email@ejemplo.com'), {
    target: { value: 'marta@test.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Ej: 3128553060'), {
    target: { value: '3128553060' },
  });
  fireEvent.change(screen.getByPlaceholderText('Contraseña (mín. 6 caracteres)'), {
    target: { value: '123456' },
  });
  fireEvent.change(screen.getByLabelText('Rol'), {
    target: { value: String(Rol.MANICURISTA) },
  });
}

describe('EmpleadasPage — esquema de pago (tipoPago)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
  });

  it('modo MIXTO envía sueldoFijo Y porcentajeComisionServicio en el payload', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    fireEvent.click(screen.getByRole('button', { name: 'Mixto' }));
    fireEvent.change(screen.getByPlaceholderText('Ej: 50'), { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: 1200000'), { target: { value: '1200000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));

    expect(mockPost).toHaveBeenCalledWith(
      '/salones/1/empleadas',
      expect.objectContaining({
        sueldoFijo: 1200000,
        porcentajeComisionServicio: 30,
      }),
    );
  });

  it('modo COMISION envía porcentaje y anula sueldoFijo (0)', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    fireEvent.change(screen.getByPlaceholderText('Ej: 50'), { target: { value: '40' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));

    expect(mockPost).toHaveBeenCalledWith(
      '/salones/1/empleadas',
      expect.objectContaining({
        sueldoFijo: 0,
        porcentajeComisionServicio: 40,
      }),
    );
  });

  it('modo FIJO envía sueldoFijo y anula porcentaje (0)', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    fireEvent.click(screen.getByRole('button', { name: 'Sueldo Fijo $' }));
    fireEvent.change(screen.getByPlaceholderText('Ej: 1200000'), {
      target: { value: '1200000' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));

    expect(mockPost).toHaveBeenCalledWith(
      '/salones/1/empleadas',
      expect.objectContaining({
        sueldoFijo: 1200000,
        porcentajeComisionServicio: 0,
      }),
    );
  });

  it('edición de empleada MIXTO existente precarga modo Mixto con ambos campos', async () => {
    defaultApiMock([
      {
        id: 5,
        nombre: 'Rosa',
        email: 'rosa@test.com',
        numeroWhatsApp: '3000000000',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 1200000,
        bonoHorario: 0,
        activo: true,
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByLabelText('Editar'));

    // Ambos campos precargados → el modo detectado es MIXTO
    // (MoneyInput muestra el sueldo con separador de miles)
    expect(screen.getByDisplayValue('1.200.000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });
});

describe('EmpleadasPage — frecuencia de pago', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
  });

  it('envía frecuenciaPago MENSUAL por defecto al crear', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));

    expect(mockPost).toHaveBeenCalledWith(
      '/salones/1/empleadas',
      expect.objectContaining({ frecuenciaPago: 'MENSUAL' }),
    );
  });

  it('envía frecuenciaPago QUINCENAL al seleccionarla', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    fireEvent.change(screen.getByLabelText('Frecuencia de pago'), {
      target: { value: 'QUINCENAL' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));

    expect(mockPost).toHaveBeenCalledWith(
      '/salones/1/empleadas',
      expect.objectContaining({ frecuenciaPago: 'QUINCENAL' }),
    );
  });

  it('precarga la frecuencia de pago al editar una empleada QUINCENAL', async () => {
    defaultApiMock([
      {
        id: 7,
        nombre: 'Luz',
        email: 'luz@test.com',
        numeroWhatsApp: '3000000001',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 1200000,
        bonoHorario: 0,
        frecuenciaPago: 'QUINCENAL',
        activo: true,
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByLabelText('Editar'));

    expect(screen.getByLabelText('Frecuencia de pago')).toHaveValue('QUINCENAL');
  });

  it('muestra el badge de frecuencia en la columna Pago', async () => {
    defaultApiMock([
      {
        id: 8,
        nombre: 'Ana',
        email: 'ana@test.com',
        numeroWhatsApp: '3000000002',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 0,
        sueldoFijo: 1200000,
        bonoHorario: 0,
        frecuenciaPago: 'QUINCENAL',
        activo: true,
      },
    ]);

    renderPage();

    expect(await screen.findByText('QUINCENAL')).toBeInTheDocument();
  });

  it('ofrece la opción "Semanal" en el select de frecuencia', async () => {
    defaultApiMock();
    renderPage();
    await openCreateModal();

    const options = within(screen.getByLabelText('Frecuencia de pago'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toContain('Semanal');
  });

  it('envía frecuenciaPago SEMANAL al seleccionarla al crear', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    fireEvent.change(screen.getByLabelText('Frecuencia de pago'), {
      target: { value: 'SEMANAL' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));

    expect(mockPost).toHaveBeenCalledWith(
      '/salones/1/empleadas',
      expect.objectContaining({ frecuenciaPago: 'SEMANAL' }),
    );
  });

  it('openEdit NO resetea SEMANAL a MENSUAL (passthrough de los 3 valores)', async () => {
    defaultApiMock([
      {
        id: 9,
        nombre: 'Sem',
        email: 'sem@test.com',
        numeroWhatsApp: '3000000003',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 1200000,
        bonoHorario: 0,
        frecuenciaPago: 'SEMANAL',
        activo: true,
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByLabelText('Editar'));

    expect(screen.getByLabelText('Frecuencia de pago')).toHaveValue('SEMANAL');
  });
});

describe('EmpleadasPage — paginación (client-side)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
  });

  function manyEmpleadas(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      nombre: `Empleado ${i + 1}`,
      email: `emp${i + 1}@test.com`,
      numeroWhatsApp: '3000000000',
      rol: Rol.MANICURISTA,
      porcentajeComisionServicio: 30,
      sueldoFijo: 0,
      bonoHorario: 0,
      activo: true,
    }));
  }

  it('muestra solo 12 empleados en la página 1 y el patrón estándar de paginación', async () => {
    defaultApiMock(manyEmpleadas(13));

    renderPage();

    expect(await screen.findByText('Empleado 1')).toBeInTheDocument();
    // Página 1: primeros 12 → el empleado 13 NO se ve todavía
    expect(screen.queryByText('Empleado 13')).not.toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2 (13 empleados)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente →' })).toBeEnabled();
  });

  it('navega a la página 2 con Siguiente y ve el empleado restante', async () => {
    defaultApiMock(manyEmpleadas(13));

    renderPage();

    await screen.findByText('Empleado 1');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    expect(await screen.findByText('Empleado 13')).toBeInTheDocument();
    expect(screen.queryByText('Empleado 1')).not.toBeInTheDocument();
    expect(screen.getByText('Página 2 de 2 (13 empleados)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente →' })).toBeDisabled();
  });

  it('vuelve a la página 1 al buscar', async () => {
    defaultApiMock(manyEmpleadas(13));

    renderPage();

    await screen.findByText('Empleado 1');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await screen.findByText('Empleado 13');

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o email...'), {
      target: { value: 'Empleado 5' },
    });

    expect(await screen.findByText('Empleado 5')).toBeInTheDocument();
    expect(screen.queryByText('Empleado 6')).not.toBeInTheDocument();
    // Con un solo resultado la barra de paginación desaparece (totalPages = 1)
    expect(screen.queryByText(/Página \d de \d \(\d+ empleados\)/)).not.toBeInTheDocument();
  });
});
