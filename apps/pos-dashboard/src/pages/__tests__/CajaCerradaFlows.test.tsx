import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

/** Listener global para el custom event caja-refresh (los banners de ambas páginas lo escuchan). */
const refreshSpy = vi.fn();

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

const cajaCerradaError = {
  response: {
    status: 422,
    data: {
      ok: false,
      data: null,
      error: {
        code: 'CAJA_CERRADA',
        message: 'No hay caja abierta para el salón. Abrí la caja antes de vender.',
      },
    },
  },
};

/** Cita de hoy a las 10:00 local (dentro de la semana visible del calendario). */
function citaHoy(): Record<string, unknown> {
  const fechaHora = new Date(new Date().setHours(10, 0, 0, 0)).toISOString();
  return {
    id: 1,
    salonId: 1,
    fechaHora,
    estado: 'CONFIRMADA',
    clienteId: 1,
    usuarioId: 1,
    servicios: [{ id: 1, nombre: 'Corte', duracionMinutos: 60, precioBase: 30000, costoBaseInsumos: 0 }],
    creadoEn: new Date().toISOString(),
  };
}

/** Mock genérico para AgendaPage/VentasPage: caja cerrada, una cita hoy, catálogos mínimos. */
function defaultApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('/caja/cierres')) {
      return Promise.resolve({
        data: { ok: true, data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } },
      });
    }
    if (url.includes('/agenda/citas')) return Promise.resolve({ data: [citaHoy()] });
    if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test' }] });
    if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'Empleada Test' }] });
    if (url.includes('/servicios')) return Promise.resolve({ data: [] });
    if (url.includes('/productos')) {
      return Promise.resolve({
        data: [{ id: 1, nombre: 'Shampoo', marca: null, precioVenta: 20000, cantidadStock: 10, categoriaId: 1 }],
      });
    }
    if (url.includes('/categorias')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  });
}

describe('AgendaPage — completar cita con caja cerrada (regla de oro)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
    defaultApiMock();
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('POST /registros con CAJA_CERRADA → mensaje en el modal, NO completa la cita y refresca el banner', async () => {
    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );

    // Abrir la cita CONFIRMADA desde el calendario
    fireEvent.click(await screen.findByText('Cliente Test'));
    // Abrir el modal de completar
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }));

    mockPost.mockRejectedValueOnce(cajaCerradaError);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    // Mensaje accionable visible en el modal de completar
    expect(await screen.findByText(/no hay caja abierta\. abrí la caja primero para completar la cita/i)).toBeInTheDocument();
    // El modal permanece abierto
    expect(screen.getByRole('button', { name: 'Confirmar y Registrar' })).toBeInTheDocument();
    // La cita NO se completó (el POST /completar nunca se disparó)
    expect(mockPost.mock.calls.some(([url]) => String(url).includes('/completar'))).toBe(false);
    // Se refrescó el banner de caja
    expect(refreshSpy).toHaveBeenCalled();
  });
});

describe('VentasPage — cobrar con caja cerrada (regla de oro)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
    defaultApiMock();
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('POST /registros con CAJA_CERRADA → mensaje visible, carrito intacto (flujo abierto) y refresca banner', async () => {
    render(
      <MemoryRouter>
        <VentasPage />
      </MemoryRouter>,
    );

    // Agregar producto al carrito
    fireEvent.click(await screen.findByText('Shampoo'));
    // Cliente + empleada (combos[0] es el filtro de categoría de la toolbar)
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[1], { target: { value: '1' } });
    fireEvent.change(combos[2], { target: { value: '1' } });
    // Pago con tarjeta (evita exigir monto recibido)
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));

    mockPost.mockRejectedValueOnce(cajaCerradaError);
    fireEvent.click(screen.getByRole('button', { name: /^Cobrar/ }));

    // Mensaje accionable visible
    expect(await screen.findByText(/no hay caja abierta\. abrí la caja primero para vender/i)).toBeInTheDocument();
    // El flujo sigue abierto: botón Cobrar con el total del carrito intacto (no se limpió el carrito)
    expect(screen.getByRole('button', { name: /^Cobrar\s+\$\s*20\.000/ })).toBeInTheDocument();
    // Sin mensaje de éxito
    expect(screen.queryByText(/venta registrada con éxito/i)).not.toBeInTheDocument();
    // Se refrescó el banner de caja
    expect(refreshSpy).toHaveBeenCalled();
  });
});
