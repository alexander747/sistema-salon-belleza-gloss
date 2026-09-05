import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

import VentasPage from '../VentasPage';
import styles from '../VentasPage.module.css';

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

function defaultApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/productos')) return Promise.resolve({ data: [] });
    if (url.includes('/categorias')) return Promise.resolve({ data: [] });
    if (url.includes('/clientes')) return Promise.resolve({ data: [] });
    if (url.includes('/empleadas')) {
      return Promise.resolve({
        data: [
          { id: 1, nombre: 'María', activo: true },
          { id: 2, nombre: 'Inactiva', activo: false },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ventas']}>
      <VentasPage />
    </MemoryRouter>,
  );
}

describe('VentasPage — empleadas inactivas filtradas', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    defaultApiMock();
  });

  it('pide solo empleadas activas al backend y no muestra inactivas en el carrito', async () => {
    renderPage();

    // Espera a que la data cargue (María aparece) — garantiza que el GET de empleadas ya ocurrió
    expect(await screen.findByText('María')).toBeInTheDocument();

    // El GET de empleadas incluye activo=true (server-side filter)
    const empleadasCall = mockGet.mock.calls.find(([url]) => String(url).includes('/empleadas'));
    expect(empleadasCall?.[1]).toEqual({ params: { activo: true } });

    const combos = screen.getAllByRole('combobox');
    // [0] = categorías, [1] = cliente, [2] = empleada
    const empleadaSelect = combos[2];
    expect(within(empleadaSelect).getByText('María')).toBeInTheDocument();
    expect(within(empleadaSelect).queryByText('Inactiva')).not.toBeInTheDocument();
  });

  it('sigue filtrando en el cliente aunque el backend devuelva inactivas (defensa en profundidad)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/productos')) return Promise.resolve({ data: [] });
      if (url.includes('/categorias')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/empleadas')) {
        // Simula un backend que ignora el filtro: devuelve activas e inactivas
        return Promise.resolve({
          data: [
            { id: 1, nombre: 'María', activo: true },
            { id: 2, nombre: 'Inactiva', activo: false },
            { id: 3, nombre: 'Sin campo', activo: undefined },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
    renderPage();

    expect(await screen.findByText('María')).toBeInTheDocument();
    const combos = screen.getAllByRole('combobox');
    const empleadaSelect = combos[2];
    expect(within(empleadaSelect).getByText('María')).toBeInTheDocument();
    expect(within(empleadaSelect).getByText('Sin campo')).toBeInTheDocument(); // activo undefined = activa
    expect(within(empleadaSelect).queryByText('Inactiva')).not.toBeInTheDocument();
  });
});

describe('VentasPage — carrito y cobro (happy path)', () => {
  const producto = { id: 1, nombre: 'Shampoo', marca: null, precioVenta: 20000, cantidadStock: 10, categoriaId: 1 };

  function cartApiMock() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/productos')) return Promise.resolve({ data: [producto] });
      if (url.includes('/categorias')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', activo: true }] });
      }
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'María', activo: true }] });
      }
      return Promise.resolve({ data: [] });
    });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    cartApiMock();
  });

  it('agregar producto al carrito actualiza el line item y el total', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Shampoo'));

    // El line item del carrito muestra precio × cantidad y el total
    expect(await screen.findByText('$ 20.000 × 1')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    // "$ 20.000" aparece en el line item y en el total del carrito
    expect(screen.getAllByText('$ 20.000').length).toBeGreaterThanOrEqual(2);

    // Sumar otra unidad con el botón "+" del carrito → cantidad 2, total 40.000
    fireEvent.click(screen.getByRole('button', { name: '+' }));

    expect(await screen.findByText('$ 20.000 × 2')).toBeInTheDocument();
    expect(screen.getAllByText('$ 40.000').length).toBeGreaterThanOrEqual(2);
  }, 20000);

  it('cobrar con tarjeta hace POST /registros con el payload del carrito', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(await screen.findByText('Shampoo'));
    fireEvent.click(screen.getByRole('button', { name: '+' })); // cantidad 2

    // combos: [0] filtro categoría, [1] cliente, [2] empleada
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[1], { target: { value: '1' } });
    fireEvent.change(combos[2], { target: { value: '1' } });

    // Tarjeta evita exigir monto recibido
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));

    // El botón usa formatCurrency (NBSP entre $ y el monto): matcher por regex
    const cobrarBtn = screen.getByRole('button', { name: /^Cobrar\s+\$\s*40\.000/ });
    expect(cobrarBtn).toBeEnabled();
    fireEvent.click(cobrarBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          salonId: 1,
          clienteId: 1,
          usuarioId: 1,
          totalServicios: 0,
          totalProductos: 40000,
          montoTotal: 40000,
          pagos: [{ monto: 40000, metodoPago: 'TARJETA' }],
          productosVendidos: [{ productoId: 1, cantidad: 2 }],
          notas: 'Venta directa: 2x Shampoo',
        }),
      );
    });

    // Confirmación visible (✅ antes del texto) y carrito limpio
    expect(await screen.findByText(/Venta registrada con éxito/)).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText('Seleccioná productos de la lista para agregarlos al carrito.'),
      ).toBeInTheDocument();
    });
  }, 20000);
});

describe('VentasPage — escáner de código de barras (PR2)', () => {
  const productoBarra = {
    id: 7,
    nombre: 'Aceite Argan',
    marca: null,
    precioVenta: 25000,
    cantidadStock: 8,
    categoriaId: 1,
    codigoBarras: '7701234567899',
  };

  function apiMockConProductos() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/productos')) return Promise.resolve({ data: [productoBarra] });
      if (url.includes('/categorias')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', activo: true }] });
      }
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'María', activo: true }] });
      }
      return Promise.resolve({ data: [] });
    });
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
    apiMockConProductos();
  });

  it('escanear un código existente agrega el producto al carrito y limpia el input', async () => {
    renderPage();

    await screen.findByText('Aceite Argan');

    const scan = scanear('7701234567899');

    expect(await screen.findByText('$ 25.000 × 1')).toBeInTheDocument();
    expect(scan.value).toBe('');
  });

  it('escanear el mismo código otra vez incrementa la cantidad (+1)', async () => {
    renderPage();

    await screen.findByText('Aceite Argan');

    scanear('7701234567899');
    expect(await screen.findByText('$ 25.000 × 1')).toBeInTheDocument();

    scanear('7701234567899');
    expect(await screen.findByText('$ 25.000 × 2')).toBeInTheDocument();
  });

  it('código desconocido muestra "Producto no encontrado" y el mensaje desaparece al tipear', async () => {
    renderPage();

    await screen.findByText('Aceite Argan');

    scanear('000');

    expect(await screen.findByText(/Producto no encontrado/)).toBeInTheDocument();

    const scan = screen.getByPlaceholderText(/escanear código/i);
    fireEvent.change(scan, { target: { value: '7' } });
    expect(screen.queryByText(/Producto no encontrado/)).not.toBeInTheDocument();
  });
});

describe('VentasPage — recibo tras cobrar (PR2)', () => {
  const productoBarra = {
    id: 7,
    nombre: 'Aceite Argan',
    marca: null,
    precioVenta: 25000,
    cantidadStock: 8,
    categoriaId: 1,
    codigoBarras: '7701234567899',
  };

  function apiMockConProductos() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/productos')) return Promise.resolve({ data: [productoBarra] });
      if (url.includes('/categorias')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', activo: true }] });
      }
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'María', activo: true }] });
      }
      return Promise.resolve({ data: [] });
    });
  }

  /** Escanea 1 producto + cliente + empleada + pago Tarjeta y cobra. */
  async function cobrarConTarjeta() {
    fireEvent.click(await screen.findByText('Aceite Argan'));
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[1], { target: { value: '1' } }); // cliente
    fireEvent.change(combos[2], { target: { value: '1' } }); // empleada
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
    fireEvent.click(screen.getByRole('button', { name: /^Cobrar\s+\$\s*25\.000/ }));
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    apiMockConProductos();
  });

  it('tras cobrar muestra el ReciboModal con cliente, línea, total y Nº del registro', async () => {
    mockPost.mockResolvedValue({
      data: { id: 55, fechaHora: '2026-09-04T12:00:00.000Z', montoTotal: 25000 },
    });
    renderPage();

    await cobrarConTarjeta();

    const dialog = await screen.findByRole('dialog', { name: 'Recibo de venta' });
    expect(within(dialog).getByText('Recibo de venta')).toBeInTheDocument();
    expect(within(dialog).getByText('Cliente Test')).toBeInTheDocument();
    expect(within(dialog).getByText('María')).toBeInTheDocument();
    expect(within(dialog).getByText('Aceite Argan')).toBeInTheDocument();
    expect(within(dialog).getByText('Nº 55')).toBeInTheDocument();
  });

  it('el banner de éxito sigue apareciendo detrás del recibo y Cerrar lo deja visible', async () => {
    mockPost.mockResolvedValue({ data: { id: 1 } });
    renderPage();

    await cobrarConTarjeta();

    // Banner de éxito (el recibo se muestra encima; el banner permanece)
    expect(await screen.findByText(/Venta registrada con éxito/)).toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: 'Recibo de venta' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog', { name: 'Recibo de venta' })).not.toBeInTheDocument();
  });
});

describe('VentasPage — fecha de negocio / backfill (PR3)', () => {
  const producto = { id: 1, nombre: 'Shampoo', marca: null, precioVenta: 20000, cantidadStock: 10, categoriaId: 1 };

  function toISODateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const fechaPasada = toISODateLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  function cartApiMock() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/productos')) return Promise.resolve({ data: [producto] });
      if (url.includes('/categorias')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', activo: true }] });
      }
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'María', activo: true }] });
      }
      return Promise.resolve({ data: [] });
    });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    cartApiMock();
  });

  /** Agrega 1 producto + cliente + empleada y cobra con tarjeta (opcional: cambia la fecha). */
  async function cobrarCarrito(fechaISO?: string) {
    fireEvent.click(await screen.findByText('Shampoo'));
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[1], { target: { value: '1' } });
    fireEvent.change(combos[2], { target: { value: '1' } });
    if (fechaISO) {
      fireEvent.change(document.querySelector('input[type="date"]')!, {
        target: { value: fechaISO },
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
    fireEvent.click(screen.getByRole('button', { name: /^Cobrar\s+\$\s*20\.000/ }));
  }

  it('muestra un input de fecha con default hoy en el panel de cobro', async () => {
    const { container } = renderPage();

    await screen.findByText('Shampoo');

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    expect(dateInput.value).toBe(toISODateLocal(new Date()));
  }, 20000);

  it('cobrar sin tocar la fecha envía fechaHora = hoy a las 12:00 local', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderPage();

    await cobrarCarrito();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          fechaHora: new Date(`${toISODateLocal(new Date())}T12:00:00`).toISOString(),
        }),
      );
    });
  }, 20000);

  it('cobrar con fecha pasada envía fechaHora = esa fecha a las 12:00 local (backfill)', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderPage();

    await cobrarCarrito(fechaPasada);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          fechaHora: new Date(`${fechaPasada}T12:00:00`).toISOString(),
        }),
      );
    });
  }, 20000);

  it('409 CAJA_NO_ABIERTA_EN_FECHA → muestra el mensaje del backend y el carrito queda intacto', async () => {
    mockPost.mockRejectedValueOnce({
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
    });
    renderPage();

    await cobrarCarrito(fechaPasada);

    expect(await screen.findByText(/no hay caja abierta para la fecha/i)).toBeInTheDocument();
    // El carrito sigue con el producto (el flujo permanece abierto)
    expect(screen.getByText('$ 20.000 × 1')).toBeInTheDocument();
  }, 20000);
});

describe('VentasPage — contratos responsive (R5)', () => {
  const producto = { id: 1, nombre: 'Shampoo', marca: null, precioVenta: 20000, cantidadStock: 10, categoriaId: 1 };

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/productos')) return Promise.resolve({ data: [producto] });
      if (url.includes('/categorias')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', activo: true }] });
      }
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'María', activo: true }] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('el layout usa la clase .ventasLayout y envuelve catálogo + carrito', async () => {
    const { container } = renderPage();

    await screen.findByText('Shampoo');
    const layout = container.querySelector(`.${styles.ventasLayout}`);
    expect(layout).not.toBeNull();
    // El contenedor responsive contiene ambos paneles (stack ≤900px preserva el orden del DOM)
    expect(within(layout as HTMLElement).getByPlaceholderText(/buscar producto/i)).toBeInTheDocument();
    expect(within(layout as HTMLElement).getByText(/carrito de venta/i)).toBeInTheDocument();
  });

  it('el grid de productos usa la clase .productGrid (auto-fill ≤900px)', async () => {
    const { container } = renderPage();

    await screen.findByText('Shampoo');
    const grid = container.querySelector(`.${styles.productGrid}`);
    expect(grid).not.toBeNull();
    expect(within(grid as HTMLElement).getByText('Shampoo')).toBeInTheDocument();
  });

  it('los botones de cantidad del carrito tienen target táctil ≥40px', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Shampoo'));

    const minus = screen.getByRole('button', { name: '−' });
    const plus = screen.getByRole('button', { name: '+' });
    expect(minus).toHaveStyle({ minWidth: '40px', minHeight: '40px' });
    expect(plus).toHaveStyle({ minWidth: '40px', minHeight: '40px' });
  });
});

describe('VentasPage — fiado y pago parcial (PR3)', () => {
  const producto = { id: 1, nombre: 'Shampoo', marca: null, precioVenta: 100000, cantidadStock: 10, categoriaId: 1 };

  function cartApiMock(precio: number) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/productos')) {
        return Promise.resolve({ data: [{ ...producto, precioVenta: precio }] });
      }
      if (url.includes('/categorias')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', activo: true }] });
      }
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'María', activo: true }] });
      }
      return Promise.resolve({ data: [] });
    });
  }

  /** Agrega el producto + cliente + empleada y activa el toggle Fiado. */
  async function llenarCarritoConFiado(montoCobrar?: string) {
    fireEvent.click(await screen.findByText('Shampoo'));
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[1], { target: { value: '1' } }); // cliente
    fireEvent.change(combos[2], { target: { value: '1' } }); // empleada
    fireEvent.click(screen.getByLabelText(/fiado/i));
    if (montoCobrar) {
      fireEvent.change(screen.getByLabelText('Monto a cobrar'), { target: { value: montoCobrar } });
    }
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    cartApiMock(100000);
  });

  it('fiado total: toggle ON → pago 0, muestra "Queda pendiente" y envía pagos [{monto:0}]', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderPage();

    await llenarCarritoConFiado();

    // Total 100.000 − propina 0 − pago 0 → queda pendiente 100.000
    expect(await screen.findByText(/Queda pendiente: \$\s*100\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cobrar\s+\$\s*100\.000/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          pagos: [{ monto: 0, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
  }, 20000);

  it('pago parcial: monto 60.000 de total 100.000 → pagos [{monto:60000}] y pendiente 40.000', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderPage();

    await llenarCarritoConFiado('60000');

    expect(await screen.findByText(/Queda pendiente: \$\s*40\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cobrar\s+\$\s*100\.000/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          pagos: [{ monto: 60000, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
  }, 20000);

  it('fiado OFF: efectivo con monto recibido completo → pagos [{monto:20000}] y sin mensaje de pendiente', async () => {
    cartApiMock(20000);
    mockPost.mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(await screen.findByText('Shampoo'));
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[1], { target: { value: '1' } });
    fireEvent.change(combos[2], { target: { value: '1' } });

    // EFECTIVO default: monto recibido = total (20.000) habilita el botón
    fireEvent.change(screen.getByLabelText('Monto recibido'), { target: { value: '20000' } });
    expect(screen.queryByText(/Queda pendiente/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cobrar\s+\$\s*20\.000/ }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/registros',
        expect.objectContaining({
          pagos: [{ monto: 20000, metodoPago: 'EFECTIVO' }],
        }),
      );
    });
  }, 20000);
});
