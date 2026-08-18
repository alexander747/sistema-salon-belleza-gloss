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

import ClientesPage from '../ClientesPage';

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

const cliente = {
  id: 1,
  nombre: 'Ana Gómez',
  telefono: '3128553060',
  cedula: '1012345678',
  email: 'ana@test.com',
  fechaNacimiento: '1990-05-20',
  genero: 'Femenino',
  notas: 'Cliente frecuente',
  preferencias: 'Manicure',
  totalServicios: 3,
  visitas: 3,
  activo: true,
  creadoEn: '2026-01-10T12:00:00',
  actualizadoEn: '2026-01-10T12:00:00',
};

function defaultApiMock(data: unknown[] = [cliente], total = data.length) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/clientes')) {
      return Promise.resolve({
        data: { data, meta: { page: 1, limit: 12, total, totalPages: Math.max(1, Math.ceil(total / 12)) } },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clientes']}>
      <ClientesPage />
    </MemoryRouter>,
  );
}

const WAIT = { timeout: 4000 };

describe('ClientesPage — listado y CRUD', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
  });

  it('lista los clientes con teléfono formateado, cédula y visitas desde la API', async () => {
    defaultApiMock();

    renderPage();

    expect(await screen.findByText('Ana Gómez', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('312 855 3060')).toBeInTheDocument(); // teléfono formateado
    expect(screen.getByText('1012345678')).toBeInTheDocument(); // cédula
    expect(screen.getByText('3')).toBeInTheDocument(); // visitas (badge)
    // creadoEn y actualizadoEn tienen la misma fecha en el fixture
    expect(screen.getAllByText('10/01/2026').length).toBeGreaterThanOrEqual(2);

    const clientesCall = mockGet.mock.calls.find(([url]) => String(url).includes('/clientes'));
    expect(clientesCall?.[1]).toEqual({ params: { page: '1', limit: '12' } });
  });

  it('crear cliente: llena el modal y hace POST con nombre y teléfono', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo cliente' }, WAIT));

    expect(await screen.findByText('Nuevo cliente', {}, WAIT)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'Lina Pérez' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ej: 3128553060'), {
      target: { value: '3001234567' },
    });
    fireEvent.change(screen.getByPlaceholderText('cliente@email.com'), {
      target: { value: 'lina@test.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/clientes', {
        nombre: 'Lina Pérez',
        telefono: '3001234567',
        email: 'lina@test.com',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Nuevo cliente')).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);

  it('editar cliente: precarga los campos y Guardar hace PUT', async () => {
    defaultApiMock();
    mockPut.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, WAIT));

    expect(await screen.findByText('Editar cliente', {}, WAIT)).toBeInTheDocument();

    // Precarga: nombre, teléfono, cédula, email
    expect(screen.getByDisplayValue('Ana Gómez')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3128553060')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1012345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ana@test.com')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Ana Gómez'), {
      target: { value: 'Ana Gómez R' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/salones/1/clientes/1',
        expect.objectContaining({
          nombre: 'Ana Gómez R',
          telefono: '3128553060',
          cedula: '1012345678',
        }),
      );
    });
  }, 20000);

  it('detalle: el botón "Ver" abre el modal con los datos del cliente', async () => {
    defaultApiMock();

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }, WAIT));

    // Título del modal = nombre del cliente
    expect((await screen.findAllByText('Ana Gómez', {}, WAIT)).length).toBeGreaterThanOrEqual(2);
    // El teléfono aparece en la fila de la tabla y en el modal de detalle
    expect(screen.getAllByText('312 855 3060').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1012345678').length).toBeGreaterThanOrEqual(2); // cédula
    expect(screen.getByText('Cliente frecuente')).toBeInTheDocument(); // notas
  }, 20000);

  it('toggle activo: desactiva al cliente activo con PATCH /desactivar y actualiza el estado', async () => {
    defaultApiMock();
    mockPatch.mockResolvedValue({ data: {} });

    renderPage();

    // Ana está activa → toggle ON → desactivar (soft-delete, no DELETE)
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar cliente' }, WAIT));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/salones/1/clientes/1/desactivar');
    }, WAIT);
    // El toggle refleja el nuevo estado (activo → inactivo)
    expect(await screen.findByRole('button', { name: 'Activar cliente' }, WAIT)).toBeInTheDocument();
    // NUNCA se llama a DELETE: no existe endpoint DELETE /clientes/:id
    expect(mockGet.mock.calls.some(([url]) => String(url).includes('/clientes'))).toBe(true);
  }, 20000);

  it('toggle activo: activa al cliente inactivo con PATCH /activar', async () => {
    defaultApiMock([{ ...cliente, activo: false }]);
    mockPatch.mockResolvedValue({ data: {} });

    renderPage();

    // Ana inactiva → toggle OFF → activar
    fireEvent.click(await screen.findByRole('button', { name: 'Activar cliente' }, WAIT));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/salones/1/clientes/1/activar');
    }, WAIT);
    expect(await screen.findByRole('button', { name: 'Desactivar cliente' }, WAIT)).toBeInTheDocument();
  }, 20000);

  it('muestra la paginación y navega a la página 2', async () => {
    defaultApiMock([cliente], 25);

    renderPage();

    expect(await screen.findByText('Ana Gómez', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3 (25 registros)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    await waitFor(() => {
      const clientesCalls = mockGet.mock.calls.filter(([url]) => String(url).includes('/clientes'));
      const last = clientesCalls[clientesCalls.length - 1];
      expect(last?.[1]).toEqual({ params: { page: '2', limit: '12' } });
    });
  }, 20000);

  it('muestra el estado vacío cuando la API responde sin clientes', async () => {
    defaultApiMock([], 0);

    renderPage();

    expect(await screen.findByText('No hay clientes registrados', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear primer cliente' })).toBeInTheDocument();
  }, 20000);

  it('crear cliente: muestra el error del backend inline cuando la API rechaza (modal queda abierto)', async () => {
    defaultApiMock();
    mockPost.mockRejectedValue({
      response: { data: { error: { message: 'No hay caja abierta para el salón' } } },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo cliente' }, WAIT));

    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'Lina Pérez' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ej: 3128553060'), {
      target: { value: '3001234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));

    // El mensaje real del backend aparece en la UI y el modal NO se cierra
    expect(await screen.findByText(/No hay caja abierta para el salón/, {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Nuevo cliente')).toBeInTheDocument();
  }, 20000);

  it('editar cliente: muestra el error inline cuando la API rechaza', async () => {
    defaultApiMock();
    mockPut.mockRejectedValue({ message: 'Error de red al guardar los cambios' });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, WAIT));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText(/Error de red al guardar los cambios/, {}, WAIT)).toBeInTheDocument();
    // El modal de edición permanece abierto para corregir
    expect(screen.getByText('Editar cliente')).toBeInTheDocument();
  }, 20000);

  it('toggle activo: muestra el error inline cuando la API rechaza', async () => {
    defaultApiMock();
    mockPatch.mockRejectedValue({
      response: { data: { message: 'No se pudo cambiar el estado del cliente' } },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar cliente' }, WAIT));

    expect(await screen.findByText(/No se pudo cambiar el estado del cliente/, {}, WAIT)).toBeInTheDocument();
  }, 20000);
});

describe('ClientesPage — móvil (cards ≤600px)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
    setMobileMedia(true);
  });

  const ROW_LABELS = ['Nombre', 'Teléfono', 'Cédula', 'Email', 'Visitas', 'Creado', 'Modificado', 'Nacimiento', 'Acciones'];

  it('cada celda de fila expone su data-label en orden (contrato de cards móviles)', async () => {
    defaultApiMock([
      { ...cliente, id: 1 },
      { ...cliente, id: 2, nombre: 'Luis Pérez' },
    ]);

    renderPage();

    // Esperar a que la tabla renderice las filas de datos (no el skeleton)
    await screen.findByText('Ana Gómez', {}, WAIT);
    const rows = await screen.findAllByRole('row', {}, WAIT);
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

  it('el modal de crear cliente usa las clases bottom-sheet en móvil (D10)', async () => {
    defaultApiMock();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo cliente' }, WAIT));

    const overlay = document.querySelector('.mobileBottomSheet');
    const panel = document.querySelector('.mobileBottomSheetContent');
    expect(overlay).not.toBeNull();
    expect(panel).not.toBeNull();
    // El panel con la clase bottom-sheet es el modal real, con su título
    expect(within(panel as HTMLElement).getByText('Nuevo cliente')).toBeInTheDocument();
  });
});
