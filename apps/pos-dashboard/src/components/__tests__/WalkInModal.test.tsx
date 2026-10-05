import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

import WalkInModal from '../WalkInModal';
import { setMobileMedia } from '../../test/setMobileMedia';

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

/**
 * Elige la primera opción del buscador type-ahead (Cliente/Empleada).
 * `indice` 0 = Cliente, 1 = Empleada (orden de render).
 */
function elegirDelTypeahead(indice: number) {
  const input = screen.getAllByRole('combobox')[indice];
  fireEvent.focus(input);
  fireEvent.click(screen.getAllByRole('option')[0]);
}

/** Selecciona cliente (0) y empleada (1) con los buscadores type-ahead. */
function elegirClienteYEmpleada() {
  elegirDelTypeahead(0);
  elegirDelTypeahead(1);
}

/** Llena el formulario y dispara el submit: carrito (1 servicio) + cliente + empleada + pago Tarjeta. */
async function completarFormYEnviar(fechaISO?: string) {
  fireEvent.click(await screen.findByText('Corte'));
  elegirClienteYEmpleada();
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

  it('POST por defecto (sin tocar la fecha) envía fechaHora = el momento real de hoy', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    const before = Date.now();
    renderModal({ onSuccess });

    await completarFormYEnviar();
    const after = Date.now();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({ fechaHora: expect.any(String) }),
      );
    });

    // Real now, not the former fixed 12:00 anchor.
    const [, payload] = mockPost.mock.calls[0] as [string, { fechaHora: string }];
    const timestamp = new Date(payload.fechaHora).getTime();
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
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

    // Esperar a que cargue el catálogo (los buscadores viven en el checkout).
    await screen.findByText('Corte');

    // La empleada activa aparece en el buscador; la inactiva NO.
    const empleadaInput = screen.getAllByRole('combobox')[1];
    fireEvent.focus(empleadaInput);
    const opciones = screen
      .getAllByRole('option')
      .map((o) => o.textContent ?? '');
    expect(opciones.some((t) => t.includes('María'))).toBe(true);
    expect(opciones.some((t) => t.includes('Inactiva'))).toBe(false);
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
    elegirClienteYEmpleada();
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

  it('los bloques opcionales (% y notas) están ocultos hasta activar el switch', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte'));
    llenarClienteYEmpleada();

    // Ocultos por defecto (no agrandan el modal). La propina NO existe (feature removida).
    expect(screen.queryByLabelText('Propina')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/agregar propina/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Descuento (%)')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Notas adicionales…')).not.toBeInTheDocument();

    // Se activan con su switch
    fireEvent.click(screen.getByLabelText(/agregar descuento por %/i));
    fireEvent.click(screen.getByLabelText(/agregar notas/i));

    expect(screen.getByLabelText('Descuento (%)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Notas adicionales…')).toBeInTheDocument();
  });

  it('fiado total (sin pago): el pago es $0 y queda pendiente el total', async () => {
    // Servicio 90.000, fiado con pago 0 → pendiente 90.000
    apiMockServicio(90000, 'Corte Premium');
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte Premium'));
    llenarClienteYEmpleada();
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

  it('descuento % con alcance (E2): exige nota y el payload viaja con porcentajeDescuento + alcance', async () => {
    apiMockServicio(40000, 'Corte Premium');
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte Premium'));
    llenarClienteYEmpleada();

    // Activar el bloque de descuento y aplicar 10% a SERVICIOS.
    fireEvent.click(screen.getByLabelText(/agregar descuento por %/i));
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('Alcance Servicios'));

    // El descuento exige nota → botón deshabilitado
    expect(screen.getByRole('button', { name: /^Registrar/ })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Indicá el motivo del ajuste/i), {
      target: { value: 'Cliente frecuente' },
    });

    // 40.000 − 10% = 36.000
    fireEvent.change(screen.getByLabelText('Monto recibido'), { target: { value: '36000' } });
    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          porcentajeDescuento: 10,
          descuentoAlcance: 'SERVICIOS',
          totalServicios: 40000,
          pagos: [{ monto: 36000, metodoPago: 'EFECTIVO' }],
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

    // En el carrito: línea de producto con precio unitario editable
    expect(await screen.findByLabelText('Precio Shampoo Barra')).toHaveValue(15000);
    // El input del escáner queda limpio para el siguiente código
    expect(scan.value).toBe('');
  });

  it('escanear el mismo código otra vez incrementa la cantidad (+1)', async () => {
    renderConProductos();
    await screen.findByText('Shampoo Barra');

    scanear('7701234567890');
    expect(await screen.findByText('× 1')).toBeInTheDocument();

    scanear('7701234567890');
    expect(await screen.findByText('× 2')).toBeInTheDocument();
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

    expect(await screen.findByLabelText('Precio Shampoo Barra')).toHaveValue(15000);
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
    elegirClienteYEmpleada();
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

  it('el recibo refleja el descuento % y el pendiente de un pago parcial', async () => {
    mockPost.mockResolvedValue({ data: { id: 99, fechaHora: '2026-10-03T12:00:00.000Z' } });
    renderModal();

    fireEvent.click(await screen.findByText('Corte')); // 30.000
    elegirClienteYEmpleada();
    // Descuento 10% → total 27.000 + pago parcial 10.000 (fiado)
    fireEvent.click(screen.getByLabelText(/agregar descuento por %/i));
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText(/Indicá el motivo/i), { target: { value: 'promo' } });
    // Pago parcial: fiado con monto a cobrar 10.000
    fireEvent.click(screen.getByLabelText(/fiado/i));
    fireEvent.change(screen.getByLabelText('Monto a cobrar'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Recibo de venta' });
    // Descuento = 30.000 × 10% = 3.000
    expect(within(dialog).getByText('-$ 3.000')).toBeInTheDocument();
    // Total 27.000 y Pendiente 17.000 (pagó 10.000)
    expect(within(dialog).getByText('$ 27.000')).toBeInTheDocument();
    expect(within(dialog).getByText('$ 17.000')).toBeInTheDocument();
  });
});

describe('WalkInModal — cantidad y gramos por servicio (PR2)', () => {
  const SERVICIO_POR_GRAMO = {
    id: 7,
    nombre: 'Tintura Global',
    descripcion: null,
    precioFinal: 450000,
    duracionMinutos: 120,
    categoriaId: 1,
    tipoCostoInsumo: 'POR_GRAMO',
    precioPorGramo: 1200,
  };

  // Caso reportado por el dueño: 100 g × $800 = $ 80.000.
  const SERVICIO_POR_GRAMO_800 = {
    id: 8,
    nombre: 'Alisado permanente brasileño',
    descripcion: null,
    precioFinal: 60000,
    duracionMinutos: 180,
    categoriaId: 1,
    tipoCostoInsumo: 'POR_GRAMO',
    precioPorGramo: 800,
  };

  function apiMockConGramos() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              nombre: 'Corte',
              descripcion: null,
              precioFinal: 30000,
              duracionMinutos: 60,
              categoriaId: 1,
              tipoCostoInsumo: 'FIJO',
              precioPorGramo: null,
            },
            SERVICIO_POR_GRAMO,
            SERVICIO_POR_GRAMO_800,
          ],
        });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'María' }] });
      if (url.includes('/productos')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  }

  /** Cliente + empleada + pago Tarjeta (sin monto recibido manual). */
  function llenarYSeleccionarTarjeta() {
    elegirClienteYEmpleada();
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    apiMockConGramos();
  });

  it('re-clicking a service increments cantidad (no duplicate lines) and sends cantidad=2', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    const corte = await screen.findByText('Corte');
    fireEvent.click(corte);
    expect(screen.getByLabelText('Cantidad Corte').textContent).toBe('1');

    fireEvent.click(corte);
    expect(screen.getByLabelText('Cantidad Corte').textContent).toBe('2');

    llenarYSeleccionarTarjeta();
    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          totalServicios: 60000,
          serviciosItems: [
            expect.objectContaining({ servicioId: 1, cantidad: 2, precioServicio: 30000 }),
          ],
        }),
      );
    });
  });

  it('blocks submit when a POR_GRAMO service has no grams yet', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Tintura Global'));
    llenarYSeleccionarTarjeta();

    expect(screen.getByRole('button', { name: /^Registrar/ })).toBeDisabled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sends gramosUsados for a POR_GRAMO service once grams are entered', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Tintura Global'));
    llenarYSeleccionarTarjeta();
    fireEvent.change(screen.getByLabelText('Gramos usados Tintura Global'), {
      target: { value: '95' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          totalServicios: 450000,
          serviciosItems: [
            expect.objectContaining({ servicioId: 7, gramosUsados: 95, cantidad: 1 }),
          ],
        }),
      );
    });
  });

  it('no ofrece editar el costo de insumos: solo lectura y el payload no manda costoInsumosOverride', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Tintura Global'));
    llenarYSeleccionarTarjeta();
    fireEvent.change(screen.getByLabelText('Gramos usados Tintura Global'), {
      target: { value: '95' },
    });

    // El costo de insumos ya no es editable: no hay input numérico para esa línea.
    expect(
      screen.queryByRole('spinbutton', { name: 'Costo de insumos Tintura Global' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          serviciosItems: [expect.objectContaining({ servicioId: 7, gramosUsados: 95 })],
        }),
      );
    });
    const payload = mockPost.mock.calls[0][1] as {
      serviciosItems: Array<Record<string, unknown>>;
    };
    expect(payload.serviciosItems[0].costoInsumosOverride).toBeUndefined();
  });

  it('muestra el costo de insumos derivado en solo lectura (100 g × $800 = $ 80.000)', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Alisado permanente brasileño'));
    llenarYSeleccionarTarjeta();

    const gramosInput = screen.getByLabelText('Gramos usados Alisado permanente brasileño');
    // La captura de gramos tiene una etiqueta visible y sufijo de unidad.
    expect(screen.getByText('Gramos usados')).toBeInTheDocument();
    expect(within(gramosInput.parentElement as HTMLElement).getByText('g')).toBeInTheDocument();

    // El costo de insumos se muestra como texto derivado, no como input.
    const costoReadonly = screen.getByLabelText('Costo de insumos Alisado permanente brasileño');
    expect(costoReadonly.tagName).toBe('SPAN');
    // Sin gramos todavía: no se muestra un $ 0 engañoso.
    expect(costoReadonly).toHaveTextContent('—');

    fireEvent.change(gramosInput, { target: { value: '100' } });

    // 100 g × $800 → el valor derivado se actualiza en vivo (solo lectura).
    expect(costoReadonly).toHaveTextContent('80.000');
  });

  it('no muestra costo de insumos cuando los gramos son ∅ o 0 (sin $ 0)', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Tintura Global'));
    llenarYSeleccionarTarjeta();
    const gramosInput = screen.getByLabelText('Gramos usados Tintura Global');
    const costoReadonly = screen.getByLabelText('Costo de insumos Tintura Global');

    expect(costoReadonly).toHaveTextContent('—');

    fireEvent.change(gramosInput, { target: { value: '0' } });
    expect(costoReadonly).toHaveTextContent('—');
  });

  it('the receipt reflects the quantity of the service line', async () => {
    mockPost.mockResolvedValue({
      data: { id: 88, fechaHora: '2026-09-04T12:00:00.000Z', montoTotal: 60000 },
    });
    renderModal();

    const corte = await screen.findByText('Corte');
    fireEvent.click(corte);
    fireEvent.click(corte);
    llenarYSeleccionarTarjeta();
    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Recibo de venta' });
    const fila = within(dialog).getByText('Corte').closest('tr') as HTMLElement;
    expect(within(fila).getByText('2')).toBeInTheDocument();
    expect(within(fila).getByText('$ 60.000')).toBeInTheDocument();
  });
});

describe('WalkInModal — captura de gramos usable en móvil (PR4)', () => {
  // The grams capture UI now lives in the shared CarritoVenta component.
  const css = readFileSync(
    join(process.cwd(), 'src/components/CarritoVenta.module.css'),
    'utf-8',
  );

  it('el input de gramos vive en una fila propia de ancho completo con touch target de 44px', () => {
    // Fila propia: ocupa el 100% del cartItem (antes 70px entre stepper y precio).
    expect(css).toMatch(/\.gramsField\s*\{[^}]*flex:\s*1 0 100%/s);
    // Touch target táctil: input y contenedor ≥44px.
    expect(css).toMatch(/\.gramsInput\s*\{[^}]*height:\s*44px/s);
    expect(css).toMatch(/\.gramsInputWrap\s*\{[^}]*min-height:\s*44px/s);
  });
});

describe('WalkInModal — desglose del reparto visible (PR5)', () => {
  // Caso canónico del dueño: precioBase 550.000, POR_GRAMO $800/g,
  // ajuste a 300.000 y 30 g → insumo 24.000, a repartir 276.000, 60% = 165.600.
  const ALISADO_550 = {
    id: 9,
    nombre: 'Alisado permanente brasileño',
    descripcion: null,
    precioFinal: 550000,
    duracionMinutos: 180,
    categoriaId: 1,
    tipoCostoInsumo: 'POR_GRAMO',
    precioPorGramo: 800,
  };

  const CORTE_FIJO = {
    id: 1,
    nombre: 'Corte',
    descripcion: null,
    precioFinal: 100000,
    duracionMinutos: 60,
    categoriaId: 1,
    costoBaseInsumos: 15000,
    tipoCostoInsumo: 'FIJO',
    precioPorGramo: null,
  };

  function apiMockReparto(servicios: Array<Record<string, unknown>>) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) return Promise.resolve({ data: servicios });
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
      if (url.includes('/empleadas')) {
        return Promise.resolve({
          data: [{ id: 1, nombre: 'María', porcentajeComisionServicio: 60 }],
        });
      }
      if (url.includes('/productos')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  }

  /** Cliente + empleada (60%) sin tocar el método de pago. */
  function seleccionarClienteYEmpleada() {
    elegirClienteYEmpleada();
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
  });

  it('muestra Cobrado − Insumos = A repartir y el split por % de la empleada (E2)', async () => {
    apiMockReparto([ALISADO_550]);
    renderModal();

    fireEvent.click(await screen.findByText('Alisado permanente brasileño'));
    seleccionarClienteYEmpleada();
    fireEvent.change(screen.getByLabelText('Gramos usados Alisado permanente brasileño'), {
      target: { value: '30' },
    });

    // Descuento 20% sobre SERVICIOS: 550.000 → 440.000
    fireEvent.click(screen.getByLabelText(/agregar descuento por %/i));
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '20' } });
    fireEvent.click(screen.getByLabelText('Alcance Servicios'));

    fireEvent.click(screen.getByRole('button', { name: /ver reparto/i }));
    const panel = screen.getByRole('group', { name: 'Desglose del reparto' });
    expect(within(panel).getByText('Cobrado')).toBeInTheDocument();
    expect(within(panel).getByText('$ 440.000')).toBeInTheDocument();
    expect(within(panel).getByText('− $ 24.000')).toBeInTheDocument();
    expect(within(panel).getByText('$ 416.000')).toBeInTheDocument();
    expect(within(panel).getByText('Comisión empleada (60%)')).toBeInTheDocument();
    expect(within(panel).getByText('$ 249.600')).toBeInTheDocument();
    expect(within(panel).getByText('Queda para el salón')).toBeInTheDocument();
    expect(within(panel).getByText('$ 166.400')).toBeInTheDocument();
  });

  it('muestra el desglose también cuando hay descuento (servicio FIJO)', async () => {
    // 100.000 con 20% → 80.000, insumo fijo 15.000, comisión 60%: 65.000 × 0,6 = 39.000.
    apiMockReparto([CORTE_FIJO]);
    renderModal();

    fireEvent.click(await screen.findByText('Corte'));
    seleccionarClienteYEmpleada();
    fireEvent.click(screen.getByLabelText(/agregar descuento por %/i));
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '20' } });
    // Services-only cart → SERVICIOS is the only applicable scope (Task A).
    fireEvent.click(screen.getByLabelText('Alcance Servicios'));

    fireEvent.click(screen.getByRole('button', { name: /ver reparto/i }));
    const panel = screen.getByRole('group', { name: 'Desglose del reparto' });
    expect(within(panel).getByText('$ 80.000')).toBeInTheDocument();
    expect(within(panel).getByText('− $ 15.000')).toBeInTheDocument();
    expect(within(panel).getByText('$ 65.000')).toBeInTheDocument();
    expect(within(panel).getByText('$ 39.000')).toBeInTheDocument();
    expect(within(panel).getByText('$ 26.000')).toBeInTheDocument();
  });

  it('insumo mayor al cobrado: comisión $0 honesta y sin números negativos', async () => {
    apiMockReparto([ALISADO_550]);
    renderModal();

    fireEvent.click(await screen.findByText('Alisado permanente brasileño'));
    seleccionarClienteYEmpleada();
    fireEvent.change(screen.getByLabelText('Gramos usados Alisado permanente brasileño'), {
      target: { value: '30' },
    });
    // Descuento 96%: 550.000 → 22.000 < 24.000 de insumo.
    fireEvent.click(screen.getByLabelText(/agregar descuento por %/i));
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '96' } });
    fireEvent.click(screen.getByLabelText('Alcance Servicios'));

    fireEvent.click(screen.getByRole('button', { name: /ver reparto/i }));
    const panel = screen.getByRole('group', { name: 'Desglose del reparto' });
    // A repartir y comisión quedan en 0 (el server clampa), nunca negativos.
    expect(within(panel).getByLabelText('A repartir $ 0')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Comisión empleada $ 0')).toBeInTheDocument();
    expect(
      within(panel).getByText('La comisión queda en $0 porque el insumo supera el total cobrado.'),
    ).toBeInTheDocument();
  });

  it('el reparto vive en un modal: se abre con "Ver reparto" y se cierra volviendo al detalle', async () => {
    apiMockReparto([CORTE_FIJO]);
    renderModal();

    fireEvent.click(await screen.findByText('Corte'));
    seleccionarClienteYEmpleada();
    fireEvent.click(screen.getByLabelText(/agregar descuento por %/i));
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '20' } });

    // Cerrado: el desglose no ocupa espacio inline.
    expect(
      screen.queryByRole('group', { name: 'Desglose del reparto' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ver reparto/i }));
    expect(
      screen.getByRole('group', { name: 'Desglose del reparto' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar reparto' }));
    expect(
      screen.queryByRole('group', { name: 'Desglose del reparto' }),
    ).not.toBeInTheDocument();
    // Sigue en el detalle (modal de venta abierto).
    expect(screen.getByRole('button', { name: /^Registrar/ })).toBeInTheDocument();
  });
});

describe('WalkInModal — precios editables por línea (E1)', () => {
  const producto = {
    id: 2,
    nombre: 'Shampoo Barra',
    marca: null,
    precioVenta: 15000,
    cantidadStock: 5,
    categoriaId: 1,
  };

  function apiMock() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [{ id: 1, nombre: 'Corte', descripcion: null, precioFinal: 30000, duracionMinutos: 60, categoriaId: 1 }],
        });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'María' }] });
      if (url.includes('/productos')) return Promise.resolve({ data: [producto] });
      return Promise.resolve({ data: [] });
    });
  }

  function llenarClienteEmpleadaYTarjeta() {
    elegirClienteYEmpleada();
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    apiMock();
  });

  it('editar el precio de un servicio lo envía como precioServicio y recalcula el total', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Corte'));
    llenarClienteEmpleadaYTarjeta();

    fireEvent.change(screen.getByLabelText('Precio Corte'), { target: { value: '45000' } });
    // El botón de submit refleja el total editado.
    expect(screen.getByRole('button', { name: /^Registrar\s+\$\s*45\.000/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          totalServicios: 45000,
          serviciosItems: [
            expect.objectContaining({ servicioId: 1, precioServicio: 45000, cantidad: 1 }),
          ],
        }),
      );
    });
  });

  it('editar el precio de un producto lo envía como precioVenta y recalcula el total', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderModal();

    fireEvent.click(await screen.findByText('Shampoo Barra'));
    llenarClienteEmpleadaYTarjeta();

    fireEvent.change(screen.getByLabelText('Precio Shampoo Barra'), {
      target: { value: '20000' },
    });
    expect(screen.getByRole('button', { name: /^Registrar\s+\$\s*20\.000/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          totalProductos: 20000,
          productosVendidos: [{ productoId: 2, cantidad: 1, precioVenta: 20000 }],
        }),
      );
    });
  });
});

describe('WalkInModal — single layout (no wizard)', () => {
  const productoSingle = {
    id: 2,
    nombre: 'Shampoo Barra',
    marca: null,
    precioVenta: 15000,
    cantidadStock: 5,
    categoriaId: 1,
    codigoBarras: '7701234567890',
  };

  function apiMockSingleLayout() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [{ id: 1, nombre: 'Corte', descripcion: null, precioFinal: 30000, duracionMinutos: 60, categoriaId: 1 }],
        });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }] });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [{ id: 1, nombre: 'María' }] });
      if (url.includes('/productos')) return Promise.resolve({ data: [productoSingle] });
      return Promise.resolve({ data: [] });
    });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    apiMockSingleLayout();
  });

  afterEach(() => {
    setMobileMedia(false);
  });

  it('renders catalog and checkout together on a mobile viewport and has no stepper', async () => {
    // A touch/narrow viewport no longer switches to a wizard: one layout always.
    setMobileMedia(true);
    renderModal();

    await screen.findByText('Corte');
    // Catalog (services + products) and checkout are mounted together.
    expect(screen.getByText('Shampoo Barra')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Registrar/ })).toBeInTheDocument();
    // No wizard stepper or step navigation.
    expect(screen.queryByRole('navigation', { name: 'Pasos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Siguiente/ })).not.toBeInTheDocument();
  });

  it('submits the same payload from the single layout', async () => {
    mockPost.mockResolvedValue({ data: {} });
    setMobileMedia(true);
    renderModal();

    await completarFormYEnviar();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          totalServicios: 30000,
          serviciosItems: [
            expect.objectContaining({ servicioId: 1, precioServicio: 30000, cantidad: 1 }),
          ],
          pagos: [{ monto: 30000, metodoPago: 'TARJETA' }],
        }),
      );
    });
  });
});

describe('WalkInModal — mobile cart shortcut (post-wizard)', () => {
  function apiMockShortcut() {
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

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    refreshSpy.mockClear();
    apiMockShortcut();
    setMobileMedia(false);
  });

  afterEach(() => {
    setMobileMedia(false);
  });

  it('on a mobile viewport the bottom shortcut appears with count/total and scrolls to the checkout', async () => {
    setMobileMedia(true);
    renderModal();

    await screen.findByText('Corte');

    // Hidden while the cart is empty.
    expect(screen.queryByRole('button', { name: /ver carrito/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Corte'));

    // The shortcut shows the item count and the total.
    const shortcut = await screen.findByRole('button', { name: /ver carrito/i });
    expect(shortcut).toHaveTextContent('1 ítem');
    expect(shortcut).toHaveTextContent('30.000');

    // Clicking it targets the checkout section (spy only lives on that node).
    const checkout = screen.getByTestId('walkin-checkout');
    const scrollSpy = vi.fn();
    checkout.scrollIntoView = scrollSpy as unknown as HTMLElement['scrollIntoView'];
    fireEvent.click(shortcut);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('on desktop the bottom shortcut is absent (desktop layout unchanged)', async () => {
    setMobileMedia(false);
    renderModal();

    await screen.findByText('Corte');
    fireEvent.click(screen.getByText('Corte'));

    expect(screen.queryByRole('button', { name: /ver carrito/i })).not.toBeInTheDocument();
    // Desktop keeps its own submit button in the checkout panel.
    expect(screen.getByRole('button', { name: /^Registrar/ })).toBeInTheDocument();
  });
});
