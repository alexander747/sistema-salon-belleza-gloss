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
