import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

import WalkInModal from '../WalkInModal';

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

/** Listener global para el custom event caja-refresh (contrato PR3: los banners lo escuchan). */
const refreshSpy = vi.fn();
window.addEventListener('caja-refresh', refreshSpy);

function defaultApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/servicios')) {
      return Promise.resolve({
        data: [{ id: 1, nombre: 'Corte', descripcion: null, precioFinal: 30000, duracionMinutos: 60, categoriaId: 1 }],
      });
    }
    if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
    if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'María' }] });
    if (url.includes('/productos')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
}

function renderModal(overrides: { onSuccess?: () => void; onNavigateToCaja?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <WalkInModal
        salonId={1}
        isOpen
        onClose={() => {}}
        onSuccess={overrides.onSuccess ?? (() => {})}
        onNavigateToCaja={overrides.onNavigateToCaja}
      />
    </MemoryRouter>,
  );
}

/** Llena el formulario y dispara el submit: carrito (1 servicio) + cliente + empleada + pago Tarjeta. */
async function completarFormYEnviar() {
  fireEvent.click(await screen.findByText('Corte'));
  const combos = screen.getAllByRole('combobox');
  fireEvent.change(combos[0], { target: { value: '1' } }); // cliente
  fireEvent.change(combos[1], { target: { value: '1' } }); // empleada
  fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
  fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));
}

describe('WalkInModal — caja cerrada (regla de oro)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    defaultApiMock();
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('POST /registros con CAJA_CERRADA → mensaje accionable, modal abierto, refresca banner y NO registra', async () => {
    const onSuccess = vi.fn();
    const onNavigateToCaja = vi.fn();
    mockPost.mockRejectedValueOnce(cajaCerradaError);
    renderModal({ onSuccess, onNavigateToCaja });

    await completarFormYEnviar();

    // Mensaje accionable visible
    expect(await screen.findByText(/no hay caja abierta\. abrí la caja primero para registrar la venta/i)).toBeInTheDocument();
    // Botón "Abrir caja" disponible
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeInTheDocument();
    // Modal permanece abierto (botón de submit sigue presente)
    expect(screen.getByRole('button', { name: /^Registrar/ })).toBeInTheDocument();
    // No se registró la venta
    expect(onSuccess).not.toHaveBeenCalled();
    // Se disparó caja-refresh para que el banner recargue su estado
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('el botón "Abrir caja" navega a la pestaña Caja', async () => {
    const onNavigateToCaja = vi.fn();
    mockPost.mockRejectedValueOnce(cajaCerradaError);
    renderModal({ onNavigateToCaja });

    await completarFormYEnviar();

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir caja' }));
    expect(onNavigateToCaja).toHaveBeenCalledTimes(1);
  });

  it('errores NO-CAJA_CERRADA mantienen el comportamiento anterior (mensaje genérico, sin botón ni refresh)', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 500, data: { ok: false, error: { code: 'INTERNAL' } } },
    });
    renderModal();

    await completarFormYEnviar();

    expect(await screen.findByText(/error al registrar el servicio\. intentá de nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir caja' })).not.toBeInTheDocument();
    expect(refreshSpy).not.toHaveBeenCalled();
    // El modal sigue abierto
    expect(screen.getByRole('button', { name: /^Registrar/ })).toBeInTheDocument();
  });
});

describe('WalkInModal — empleadas inactivas filtradas', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('pide solo empleadas activas al backend y no muestra inactivas en el selector', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [{ id: 1, nombre: 'Corte', descripcion: null, precioFinal: 30000, duracionMinutos: 60, categoriaId: 1 }],
        });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
      if (url.includes('/empleadas')) {
        return Promise.resolve({
          data: [
            { id: 1, nombre: 'María', activo: true },
            { id: 2, nombre: 'Inactiva', activo: false },
          ],
        });
      }
      if (url.includes('/productos')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    renderModal();

    // El GET de empleadas incluye el filtro activo=true (server-side)
    const empleadasCall = mockGet.mock.calls.find(([url]) => String(url).includes('/empleadas'));
    expect(empleadasCall?.[1]).toEqual({ params: { activo: true } });

    // La empleada activa aparece; la inactiva NO
    expect(await screen.findByText('María')).toBeInTheDocument();
    const combos = screen.getAllByRole('combobox');
    const empleadaSelect = combos[1];
    expect(within(empleadaSelect).getByText('María')).toBeInTheDocument();
    expect(within(empleadaSelect).queryByText('Inactiva')).not.toBeInTheDocument();
  });
});
