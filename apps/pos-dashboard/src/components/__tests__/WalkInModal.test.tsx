import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

/** Fecha en formato yyyy-mm-dd local. */
function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha pasada fija (relativa a hoy) para probar backfill sin depender del reloj. */
function fechaPasada(): string {
  return toISODateLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
}

/** Llena el formulario y dispara el submit: carrito (1 servicio) + cliente + empleada + pago Tarjeta. */
async function completarFormYEnviar(fechaISO?: string) {
  fireEvent.click(await screen.findByText('Corte'));
  const combos = screen.getAllByRole('combobox');
  fireEvent.change(combos[0], { target: { value: '1' } }); // cliente
  fireEvent.change(combos[1], { target: { value: '1' } }); // empleada
  if (fechaISO) {
    fireEvent.change(document.querySelector('input[type="date"]')!, {
      target: { value: fechaISO },
    });
  }
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

describe('WalkInModal — fecha de negocio / backfill (PR3)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    defaultApiMock();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('muestra un input de fecha con default hoy', async () => {
    const { container } = renderModal();

    await screen.findByText('Corte');

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    expect(dateInput.value).toBe(toISODateLocal(new Date()));
  });

  it('POST por defecto (sin tocar la fecha) envía fechaHora = hoy a las 12:00 local', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    await completarFormYEnviar();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          fechaHora: new Date(`${toISODateLocal(new Date())}T12:00:00`).toISOString(),
        }),
      );
    });
  });

  it('cambiar la fecha a una pasada envía fechaHora = esa fecha a las 12:00 local', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    await completarFormYEnviar(fechaPasada());

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          fechaHora: new Date(`${fechaPasada()}T12:00:00`).toISOString(),
        }),
      );
    });
  });

  it('409 CAJA_NO_ABIERTA_EN_FECHA → muestra el mensaje del backend y mantiene el modal abierto', async () => {
    const cajaNoAbiertaEnFecha = {
      response: {
        status: 409,
        data: {
          ok: false,
          data: null,
          error: {
            code: 'CAJA_NO_ABIERTA_EN_FECHA',
            message:
              'No hay caja abierta para la fecha 2026-08-16 — abrí la caja de esa fecha antes de registrar la venta',
          },
        },
      },
    };
    mockPost.mockRejectedValueOnce(cajaNoAbiertaEnFecha);
    renderModal();

    await completarFormYEnviar(fechaPasada());

    expect(await screen.findByText(/no hay caja abierta para la fecha/i)).toBeInTheDocument();
    // Sin botón "Abrir caja" (la caja de hoy puede estar abierta; el fix es abrir la de esa fecha)
    expect(screen.queryByRole('button', { name: 'Abrir caja' })).not.toBeInTheDocument();
    // El modal permanece abierto para corregir la fecha o abrir la caja
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

describe('WalkInModal — fiado y pago parcial (PR3)', () => {
  /** Mock con un servicio de precio configurable (default: 30.000). */
  function apiMockServicio(precio: number, nombre: string) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [{ id: 1, nombre, descripcion: null, precioFinal: precio, duracionMinutos: 60, categoriaId: 1 }],
        });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'María' }] });
      if (url.includes('/productos')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  }

  /** Cliente + empleada (sin tocar método de pago: EFECTIVO default). */
  function llenarClienteYEmpleada() {
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[0], { target: { value: '1' } }); // cliente
    fireEvent.change(combos[1], { target: { value: '1' } }); // empleada
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    defaultApiMock();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('fiado total: toggle ON → pago 0, muestra "Queda pendiente" y envía pagos [{monto:0}]', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    fireEvent.click(await screen.findByText('Corte'));
    llenarClienteYEmpleada();

    fireEvent.click(screen.getByLabelText(/fiado/i));

    // Total 30.000 − propina 0 − pago 0 → queda pendiente 30.000
    expect(await screen.findByText(/Queda pendiente: \$\s*30\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          pagos: [{ monto: 0, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
    // PR2: tras el POST aparece el recibo; onSuccess se dispara al cerrar el recibo.
    const dialogRecibo = await screen.findByRole('dialog', { name: 'Recibo de venta' });
    expect(within(dialogRecibo).getByText('Corte')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    fireEvent.click(within(dialogRecibo).getByRole('button', { name: 'Cerrar' }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('pago parcial: monto 60.000 de un total 100.000 → pagos [{monto:60000}] y pendiente 40.000', async () => {
    apiMockServicio(100000, 'Corte Premium');
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte Premium'));
    llenarClienteYEmpleada();

    fireEvent.click(screen.getByLabelText(/fiado/i));
    // El monto a cobrar es editable (default 0)
    fireEvent.change(screen.getByLabelText('Monto a cobrar'), { target: { value: '60000' } });

    // Pendiente = 100.000 − 0 − 60.000
    expect(await screen.findByText(/Queda pendiente: \$\s*40\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          pagos: [{ monto: 60000, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
  });

  it('fiado con propina: la propina nunca se fía — queda fuera de la deuda', async () => {
    // Servicio 90.000 + propina 10.000 → total 100.000; fiado con pago 0 → pendiente 90.000
    apiMockServicio(90000, 'Corte Premium');
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte Premium'));
    llenarClienteYEmpleada();

    fireEvent.change(screen.getByLabelText('Propina'), { target: { value: '10000' } });
    fireEvent.click(screen.getByLabelText(/fiado/i));

    expect(await screen.findByText(/Queda pendiente: \$\s*90\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          pagos: [{ monto: 0, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
  });

  it('fiado OFF: pago completo de contado sin cambios (monto = montoRecibido) y sin mensaje de pendiente', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte'));
    llenarClienteYEmpleada();

    // EFECTIVO default: monto recibido = total (30.000)
    fireEvent.change(screen.getByLabelText('Monto recibido'), { target: { value: '30000' } });
    expect(screen.queryByText(/Queda pendiente/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          pagos: [{ monto: 30000, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
  });

  it('bloquea ajustar el total POR ENCIMA del precio (regla dueño): 40.000 no puede subir a 50.000', async () => {
    apiMockServicio(40000, 'Corte Premium');
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte Premium'));
    llenarClienteYEmpleada();

    // Activar "Ajustar valor total" e intentar poner 50.000 (mayor al precio)
    fireEvent.click(screen.getByLabelText(/ajustar valor total/i));
    fireEvent.change(screen.getByLabelText('Valor total ajustado'), { target: { value: '50000' } });

    // El ajuste hacia arriba se IGNORA → no se aplica (no hay nota obligatoria,
    // que solo aparece cuando hay un ajuste real hacia abajo)
    expect(screen.queryByPlaceholderText(/Indicá el motivo del ajuste/i)).not.toBeInTheDocument();
  });

  it('permite ajustar el total hacia ABAJO (descuento): 40.000 → 35.000 y guarda', async () => {
    apiMockServicio(40000, 'Corte Premium');
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte Premium'));
    llenarClienteYEmpleada();

    fireEvent.click(screen.getByLabelText(/ajustar valor total/i));
    fireEvent.change(screen.getByLabelText('Valor total ajustado'), { target: { value: '35000' } });

    // El ajuste hacia abajo exige nota
    fireEvent.change(screen.getByPlaceholderText(/Indicá el motivo del ajuste/i), {
      target: { value: 'Descuento a clienta conocida' },
    });

    // En efectivo el monto recibido es manual: la clienta pagó 35.000
    fireEvent.change(screen.getByLabelText('Monto recibido'), { target: { value: '35000' } });

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          valorFinal: 35000,
          valorOriginal: 40000,
          precioAjustado: true,
          pagos: [{ monto: 35000, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
  });
});

describe('WalkInModal — escáner de código de barras (PR2)', () => {
  const productoBarra = {
    id: 2,
    nombre: 'Shampoo Barra',
    marca: null,
    precioVenta: 15000,
    cantidadStock: 5,
    categoriaId: 1,
    codigoBarras: '7701234567890',
  };

  /** Mock con 1 servicio (Corte) + 1 producto con código de barras. */
  function apiMockConProductos() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [{ id: 1, nombre: 'Corte', descripcion: null, precioFinal: 30000, duracionMinutos: 60, categoriaId: 1 }],
        });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'María' }] });
      if (url.includes('/productos')) return Promise.resolve({ data: [productoBarra] });
      return Promise.resolve({ data: [] });
    });
  }

  function renderConProductos() {
    return render(
      <MemoryRouter>
        <WalkInModal salonId={1} isOpen onClose={() => {}} onSuccess={() => {}} />
      </MemoryRouter>,
    );
  }

  function scanear(codigo: string) {
    const scan = screen.getByPlaceholderText(/escanear código/i);
    fireEvent.change(scan, { target: { value: codigo } });
    fireEvent.keyDown(scan, { key: 'Enter' });
    return scan as HTMLInputElement;
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    apiMockConProductos();
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('escanear un código existente agrega el producto al carrito (cantidad 1) y limpia el input', async () => {
    renderConProductos();
    await screen.findByText('Shampoo Barra');

    const scan = scanear('7701234567890');

    // En el carrito: línea de producto con precio × cantidad
    expect(await screen.findByText('$ 15.000 × 1')).toBeInTheDocument();
    // El input del escáner queda limpio para el siguiente código
    expect(scan.value).toBe('');
  });

  it('escanear el mismo código otra vez incrementa la cantidad (+1)', async () => {
    renderConProductos();
    await screen.findByText('Shampoo Barra');

    scanear('7701234567890');
    expect(await screen.findByText('$ 15.000 × 1')).toBeInTheDocument();

    scanear('7701234567890');
    expect(await screen.findByText('$ 15.000 × 2')).toBeInTheDocument();
  });

  it('código desconocido muestra "Producto no encontrado" y el mensaje desaparece al tipear', async () => {
    renderConProductos();
    await screen.findByText('Shampoo Barra');

    scanear('999999');

    expect(await screen.findByText(/Producto no encontrado/)).toBeInTheDocument();

    // Al seguir escribiendo (próximo escaneo) el mensaje se limpia
    const scan = screen.getByPlaceholderText(/escanear código/i);
    fireEvent.change(scan, { target: { value: '7' } });
    expect(screen.queryByText(/Producto no encontrado/)).not.toBeInTheDocument();
  });

  it('el escaneo también funciona con espacios al rededor del código (trim)', async () => {
    renderConProductos();
    await screen.findByText('Shampoo Barra');

    scanear('  7701234567890  ');

    expect(await screen.findByText('$ 15.000 × 1')).toBeInTheDocument();
  });
});

describe('WalkInModal — recibo tras registrar (PR2)', () => {
  function apiMockRecibo() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [{ id: 1, nombre: 'Corte', descripcion: null, precioFinal: 30000, duracionMinutos: 60, categoriaId: 1 }],
        });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana Cliente' }] });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'María Empleada' }] });
      if (url.includes('/productos')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    apiMockRecibo();
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  /** Carrito: servicio Corte + cliente Ana + empleada María; pago Tarjeta. */
  async function registrarConTarjeta() {
    fireEvent.click(await screen.findByText('Corte'));
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[0], { target: { value: '1' } }); // cliente
    fireEvent.change(combos[1], { target: { value: '1' } }); // empleada
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));
  }

  it('tras el POST exitoso muestra el ReciboModal con cliente, línea, total y Nº del registro', async () => {
    mockPost.mockResolvedValue({
      data: { id: 88, fechaHora: '2026-09-04T12:00:00.000Z', montoTotal: 30000 },
    });
    const onSuccess = vi.fn();
    render(
      <MemoryRouter>
        <WalkInModal salonId={1} isOpen onClose={() => {}} onSuccess={onSuccess} />
      </MemoryRouter>,
    );

    await registrarConTarjeta();

    const dialog = await screen.findByRole('dialog', { name: 'Recibo de venta' });
    expect(within(dialog).getByText('Recibo de venta')).toBeInTheDocument();
    expect(within(dialog).getByText('Ana Cliente')).toBeInTheDocument();
    expect(within(dialog).getByText('María Empleada')).toBeInTheDocument();
    expect(within(dialog).getByText('Corte')).toBeInTheDocument();
    expect(within(dialog).getByText('Nº 88')).toBeInTheDocument();
    // El modal NO cierra solo: onSuccess espera al cierre del recibo
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('muestra el método de pago elegido en el recibo', async () => {
    mockPost.mockResolvedValue({ data: { id: 1 } });
    renderModal();

    await registrarConTarjeta();

    const dialog = await screen.findByRole('dialog', { name: 'Recibo de venta' });
    expect(within(dialog).getByText('Tarjeta')).toBeInTheDocument();
  });
});
