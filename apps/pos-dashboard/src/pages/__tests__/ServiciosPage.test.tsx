import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
}));

import ServiciosPage from '../ServiciosPage';

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

const servicio = {
  id: 1,
  nombre: 'Corte de cabello',
  descripcion: '',
  precioBase: 45000,
  precioFinal: 45000,
  duracionMinutos: 60,
  costoBaseInsumos: 5000,
  categoria: { id: 1, nombre: 'Cortes' },
  activo: true,
  creadoEn: '2026-01-10T12:00:00',
  actualizadoEn: '2026-01-10T12:00:00',
};

const servicioPaginated = (data: unknown[], total: number) => ({
  data: { data, meta: { page: 1, limit: 12, total, totalPages: Math.max(1, Math.ceil(total / 12)) } },
});

function defaultApiMock(data: unknown[] = [servicio], total = data.length) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/servicios')) return Promise.resolve(servicioPaginated(data, total));
    if (url.includes('/categorias')) {
      return Promise.resolve({ data: [{ id: 1, nombre: 'Cortes' }] });
    }
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/servicios']}>
      <ServiciosPage />
    </MemoryRouter>,
  );
}

const WAIT = { timeout: 4000 };

describe('ServiciosPage — listado y CRUD', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
  });

  it('lista los servicios con precio, duración y categoría desde la API', async () => {
    defaultApiMock();

    renderPage();

    expect(await screen.findByText('Corte de cabello', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('60 min')).toBeInTheDocument();
    expect(screen.getByText('$ 45.000')).toBeInTheDocument(); // precioBase
    expect(screen.getByText('$ 5.000')).toBeInTheDocument(); // costoBaseInsumos
    expect(screen.getByText('Cortes')).toBeInTheDocument(); // categoría
    expect(screen.getByText('Activo')).toBeInTheDocument();

    // Se pidió la primera página paginada
    const serviciosCall = mockGet.mock.calls.find(([url]) => String(url).includes('/servicios'));
    expect(String(serviciosCall?.[0])).toContain('/salones/1/servicios?page=1&limit=12');
  });

  it('crear servicio: llena el modal y hace POST con el payload', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo Servicio' }, WAIT));

    expect(await screen.findByText('Nuevo Servicio', {}, WAIT)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: Corte de cabello'), {
      target: { value: 'Corte Premium' },
    });
    // MoneyInputs del modal: [0] precio base, [1] costo base insumos
    const moneyInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(moneyInputs[0], { target: { value: '60000' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '90' } }); // duración
    fireEvent.change(moneyInputs[1], { target: { value: '8000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/servicios',
        expect.objectContaining({
          nombre: 'Corte Premium',
          precioBase: 60000,
          duracionMinutos: 90,
          costoBaseInsumos: 8000,
          activo: true,
        }),
      );
    });

    // El modal se cierra tras crear
    await waitFor(() => {
      expect(screen.queryByText('Nuevo Servicio')).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);

  it('editar servicio: precarga los campos y Guardar hace PUT', async () => {
    defaultApiMock();
    mockPut.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, WAIT));

    expect(await screen.findByText('Editar Servicio', {}, WAIT)).toBeInTheDocument();

    // Campos precargados: nombre, precio base (formateado), duración
    expect(screen.getByDisplayValue('Corte de cabello')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45.000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Corte de cabello'), {
      target: { value: 'Corte Ejecutivo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/salones/1/servicios/1',
        expect.objectContaining({ nombre: 'Corte Ejecutivo', activo: true }),
      );
    });
  }, 20000);

  it('eliminar servicio: confirmación y DELETE', async () => {
    defaultApiMock();
    mockDelete.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }, WAIT));

    expect(await screen.findByText(/¿Eliminar servicio\?/i, {}, WAIT)).toBeInTheDocument();
    // El nombre aparece en la fila y en el cuerpo del modal de confirmación
    expect(screen.getAllByText(/Corte de cabello/i).length).toBeGreaterThanOrEqual(2);

    // Hay dos botones "Eliminar" (fila + confirmación del modal): usar el del modal
    const eliminarButtons = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(eliminarButtons[eliminarButtons.length - 1]);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/salones/1/servicios/1');
    });
  }, 20000);

  it('muestra la paginación y navega a la página 2', async () => {
    defaultApiMock([servicio], 25);

    renderPage();

    expect(await screen.findByText('Corte de cabello', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3 (25 servicios)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    await waitFor(() => {
      const serviciosCalls = mockGet.mock.calls.filter(([url]) =>
        String(url).includes('/servicios'),
      );
      const last = serviciosCalls[serviciosCalls.length - 1];
      expect(String(last?.[0])).toContain('/salones/1/servicios?page=2&limit=12');
    });
  }, 20000);

  it('muestra el estado vacío "No hay servicios" cuando la API responde vacío', async () => {
    defaultApiMock([], 0);

    renderPage();

    expect(await screen.findByText('No hay servicios', {}, WAIT)).toBeInTheDocument();
    // El botón existe en el toolbar y en el estado vacío
    expect(screen.getAllByRole('button', { name: '+ Nuevo Servicio' }).length).toBeGreaterThanOrEqual(1);
  }, 20000);
});
