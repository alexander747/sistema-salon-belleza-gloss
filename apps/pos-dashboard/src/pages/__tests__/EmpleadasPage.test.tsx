import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';
import { setMobileMedia } from '../../test/setMobileMedia';

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

describe('EmpleadasPage — errores de mutación visibles en la UI', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
  });

  it('crear empleado: muestra el error del backend inline cuando la API rechaza', async () => {
    defaultApiMock();
    mockPost.mockRejectedValue({
      response: { data: { error: { message: 'Ya existe una empleada con ese email' } } },
    });

    renderPage();
    await openCreateModal();
    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));

    expect(await screen.findByText(/Ya existe una empleada con ese email/)).toBeInTheDocument();
    // El modal permanece abierto para corregir
    expect(screen.getByText('Nuevo empleado')).toBeInTheDocument();
  }, 20000);

  it('editar empleado: muestra el error inline cuando la API rechaza', async () => {
    defaultApiMock([
      {
        id: 1,
        nombre: 'Ana',
        email: 'ana@test.com',
        numeroWhatsApp: '3000000000',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: true,
      },
    ]);
    mockPut.mockRejectedValue({ message: 'Error de red al guardar' });

    renderPage();

    fireEvent.click(await screen.findByLabelText('Editar'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText(/Error de red al guardar/)).toBeInTheDocument();
    expect(screen.getByText('Editar empleado')).toBeInTheDocument();
  }, 20000);

  it('toggle activo: muestra el error inline cuando la API rechaza', async () => {
    defaultApiMock([
      {
        id: 1,
        nombre: 'Ana',
        email: 'ana@test.com',
        numeroWhatsApp: '3000000000',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: true,
      },
    ]);
    mockPatch.mockRejectedValue({
      response: { data: { message: 'No se pudo cambiar el estado de la empleada' } },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar empleado' }));

    expect(await screen.findByText(/No se pudo cambiar el estado de la empleada/)).toBeInTheDocument();
  }, 20000);

  it('toggle activo: pedir confirmación antes de desactivar (cancelar → sin PATCH)', async () => {
    defaultApiMock([
      {
        id: 1,
        nombre: 'Ana',
        email: 'ana@test.com',
        numeroWhatsApp: '3000000000',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: true,
      },
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar empleado' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
    // La empleada sigue activa (toggle sigue diciendo "Desactivar")
    expect(screen.getByRole('button', { name: 'Desactivar empleado' })).toBeInTheDocument();
  }, 20000);

  it('toggle activo: desactiva solo tras confirmar (confirm=true → PATCH /desactivar)', async () => {
    defaultApiMock([
      {
        id: 1,
        nombre: 'Ana',
        email: 'ana@test.com',
        numeroWhatsApp: '3000000000',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: true,
      },
    ]);
    mockPatch.mockResolvedValue({ data: {} });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar empleado' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockPatch).toHaveBeenCalledWith('/salones/1/empleadas/1/desactivar');
    });
    // Con el filtro default (Activos), la empleada recién desactivada desaparece de la lista.
    expect(screen.queryByRole('button', { name: 'Activar empleado' })).toBeNull();
    // Cambiando a Todos, la empleada inactiva aparece con el botón "Activar"
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'TODOS' } });
    expect(await screen.findByRole('button', { name: 'Activar empleado' })).toBeInTheDocument();
  }, 20000);

  it('toggle activo: activar NO pide confirmación (es reversible y no bloquea acceso)', async () => {
    defaultApiMock([
      {
        id: 2,
        nombre: 'Rosa',
        email: 'rosa@test.com',
        numeroWhatsApp: '3000000001',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: false,
      },
    ]);
    mockPatch.mockResolvedValue({ data: {} });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();

    // La empleada es inactiva: con el filtro default (Activos) no se ve → cambiar a Todos
    fireEvent.change(await screen.findByLabelText('Filtrar por estado'), {
      target: { value: 'TODOS' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Activar empleado' }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/salones/1/empleadas/2/activar');
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  }, 20000);
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

  it('muestra vista previa del pago por frecuencia (semanal) en el formulario', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    // Sin sueldo: no hay vista previa
    expect(screen.queryByText(/mensuales → se paga/)).not.toBeInTheDocument();

    // FIJO + sueldo 1200000 + SEMANAL → 25% = 300.000
    fireEvent.click(screen.getByRole('button', { name: 'Sueldo Fijo $' }));
    fireEvent.change(screen.getByPlaceholderText('Ej: 1200000'), {
      target: { value: '1200000' },
    });
    fireEvent.change(screen.getByLabelText('Frecuencia de pago'), {
      target: { value: 'SEMANAL' },
    });

    expect(screen.getByText('$ 300.000')).toBeInTheDocument();
    expect(screen.getByText(/por semana/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it('muestra vista previa quincenal (50%) y la oculta en MENSUAL', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();
    await openCreateModal();

    fireEvent.click(screen.getByRole('button', { name: 'Sueldo Fijo $' }));
    fireEvent.change(screen.getByPlaceholderText('Ej: 1200000'), {
      target: { value: '1000000' },
    });
    fireEvent.change(screen.getByLabelText('Frecuencia de pago'), {
      target: { value: 'QUINCENAL' },
    });

    expect(screen.getByText('$ 500.000')).toBeInTheDocument();
    expect(screen.getByText(/por quincena/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Frecuencia de pago'), {
      target: { value: 'MENSUAL' },
    });

    expect(screen.queryByText(/mensuales → se paga/)).not.toBeInTheDocument();
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

describe('EmpleadasPage — móvil (cards ≤600px)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
    setMobileMedia(true);
  });

  const ROW_LABELS = ['Nombre', 'Email', 'Rol', 'WhatsApp', 'Pago', 'Activo', 'Creado', 'Modificado', 'Nacimiento', 'Acciones'];

  it('cada celda de fila expone su data-label en orden (contrato de cards móviles)', async () => {
    defaultApiMock([
      {
        id: 1,
        nombre: 'Ana',
        email: 'ana@test.com',
        numeroWhatsApp: '3000000000',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: true,
      },
      {
        id: 2,
        nombre: 'Rosa',
        email: 'rosa@test.com',
        numeroWhatsApp: '3000000001',
        rol: Rol.DUEÑA,
        porcentajeComisionServicio: 0,
        sueldoFijo: 1200000,
        bonoHorario: 0,
        activo: true,
      },
    ]);

    renderPage();

    // Esperar a que la tabla renderice las filas de datos (no el skeleton)
    await screen.findByText('Ana');
    const rows = await screen.findAllByRole('row');
    // thead + 2 filas de datos
    expect(rows).toHaveLength(3);
    rows.slice(1).forEach((row) => {
      const cells = within(row).getAllByRole('cell');
      expect(cells).toHaveLength(ROW_LABELS.length);
      cells.forEach((cell, i) => {
        expect(cell).toHaveAttribute('data-label', ROW_LABELS[i]);
      });
    });
  });

  it('el modal de crear empleado usa las clases bottom-sheet en móvil (D10)', async () => {
    defaultApiMock();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo empleado' }));

    const overlay = document.querySelector('.mobileBottomSheet');
    const panel = document.querySelector('.mobileBottomSheetContent');
    expect(overlay).not.toBeNull();
    expect(panel).not.toBeNull();
    // El panel con la clase bottom-sheet es el modal real, con su título
    expect(within(panel as HTMLElement).getByText('Nuevo empleado')).toBeInTheDocument();
  });

  it('el filtro por estado arranca en Activos y oculta inactivos; Todos los muestra', async () => {
    defaultApiMock([
      {
        id: 1,
        nombre: 'Ana',
        email: 'ana@test.com',
        numeroWhatsApp: '3000000000',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: true,
      },
      {
        id: 2,
        nombre: 'Rosa',
        email: 'rosa@test.com',
        numeroWhatsApp: '3000000001',
        rol: Rol.MANICURISTA,
        porcentajeComisionServicio: 30,
        sueldoFijo: 0,
        bonoHorario: 0,
        activo: false,
      },
    ]);

    renderPage();

    // Default: Activos → solo Ana visible, Rosa oculta
    const select = await screen.findByLabelText('Filtrar por estado');
    expect(select).toHaveValue('ACTIVOS');
    await screen.findByText('Ana');
    expect(screen.queryByText('Rosa')).toBeNull();

    // Cambiar a Todos → Rosa aparece
    fireEvent.change(select, { target: { value: 'TODOS' } });
    expect(await screen.findByText('Rosa')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();

    // Cambiar a Inactivos → solo Rosa
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'INACTIVOS' } });
    expect(await screen.findByText('Rosa')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).toBeNull();
  });
});
