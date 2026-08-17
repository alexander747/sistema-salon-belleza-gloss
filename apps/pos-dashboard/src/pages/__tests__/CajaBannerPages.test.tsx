import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

import AgendaPage from '../AgendaPage';
import VentasPage from '../VentasPage';
import FinanzasPage from '../FinanzasPage';

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

const error404 = {
  response: {
    status: 404,
    data: { ok: false, error: { code: 'CAJA_NO_ABIERTA', message: 'No hay caja abierta' } },
  },
};

/** Mock genérico: caja cerrada, listas vacías — suficiente para montar las páginas. */
function defaultApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('/caja/cierres')) {
      return Promise.resolve({
        data: { ok: true, data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } },
      });
    }
    if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
    if (url.includes('/clientes')) return Promise.resolve({ data: [] });
    if (url.includes('/servicios')) return Promise.resolve({ data: [] });
    if (url.includes('/categorias')) return Promise.resolve({ data: [] });
    if (url.includes('/productos')) return Promise.resolve({ data: [] });
    if (url.includes('/agenda/citas')) {
      return Promise.resolve({ data: [] });
    }
    if (url.includes('/finanzas')) {
      return Promise.resolve({
        data: { ok: true, data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('CajaBanner SOLO en el tab Caja (regla de oro)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('AgendaPage NO monta el CajaBanner', async () => {
    defaultApiMock();

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );

    // Espera a que la página termine de cargar (auth resuelto + calendario visible)
    await screen.findByLabelText('Semana anterior');

    expect(screen.queryByText(/caja cerrada — abrir para vender/i)).not.toBeInTheDocument();
    expect(mockGet.mock.calls.some(([url]) => String(url).includes('/caja/actual'))).toBe(false);
  });

  it('VentasPage NO monta el CajaBanner', async () => {
    defaultApiMock();

    render(
      <MemoryRouter>
        <VentasPage />
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText(/buscar producto/i);

    expect(screen.queryByText(/caja cerrada — abrir para vender/i)).not.toBeInTheDocument();
    expect(mockGet.mock.calls.some(([url]) => String(url).includes('/caja/actual'))).toBe(false);
  });

  it('FinanzasPage: el banner NO aparece en Registros pero SÍ al activar el tab Caja', async () => {
    defaultApiMock();

    render(
      <MemoryRouter>
        <FinanzasPage />
      </MemoryRouter>,
    );

    // Tab por defecto: Registros → sin banner
    expect(screen.queryByText(/caja cerrada — abrir para vender/i)).not.toBeInTheDocument();

    // Activar el tab Caja → el banner consulta el estado de caja y aparece
    fireEvent.click(await screen.findByRole('button', { name: '💰 Caja' }));

    expect(await screen.findByText(/caja cerrada — abrir para vender/i)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/actual');
  });
});
