import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';
import { setMobileMedia } from '../../test/setMobileMedia';

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
}));

import ProductosPage from '../ProductosPage';

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

const producto = {
  id: 1,
  nombre: 'Shampoo Profesional',
  marca: 'Loreal',
  codigoBarras: '7701234567890',
  color: null,
  tamano: null,
  descripcion: null,
  urlFoto: null,
  precioVenta: 26000,
  precioCompra: 20000,
  margenGanancia: 30,
  cantidadStock: 15,
  stockMinimo: 5,
  tipoInventario: 'RETAIL',
  activo: true,
  salonId: 1,
  creadoEn: '2026-01-10T12:00:00',
  actualizadoEn: '2026-01-10T12:00:00',
};

const productoPaginated = (data: unknown[], total: number) => ({
  data: { data, meta: { page: 1, limit: 12, total, totalPages: Math.max(1, Math.ceil(total / 12)) } },
});

function defaultApiMock(data: unknown[] = [producto], total = data.length) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('historial-precios')) {
      return Promise.resolve({
        data: [
          { id: 9, productoId: 1, precioCompra: 18000, precioVenta: 23400, cantidadAgregada: 10, stockDespues: 25, fecha: '2026-02-01T12:00:00', registradoPorId: 2 },
        ],
      });
    }
    if (url.includes('/productos')) return Promise.resolve(productoPaginated(data, total));
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/productos']}>
      <ProductosPage />
    </MemoryRouter>,
  );
}

const WAIT = { timeout: 4000 };

describe('ProductosPage — listado y operaciones', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
  });

  it('lista los productos con stock, precios, margen y tipo desde la API', async () => {
    defaultApiMock();

    renderPage();

    expect(await screen.findByText('Shampoo Profesional', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // stock
    expect(screen.getByText('$ 20.000')).toBeInTheDocument(); // precio compra (rol ve costos)
    expect(screen.getByText('$ 26.000')).toBeInTheDocument(); // precio venta
    expect(screen.getByText('30%')).toBeInTheDocument(); // margen
    expect(screen.getByText('Venta')).toBeInTheDocument(); // tipo RETAIL
    expect(screen.getByText('Loreal')).toBeInTheDocument(); // marca
    expect(screen.getByText('7701234567890')).toBeInTheDocument(); // código de barras

    const productosCall = mockGet.mock.calls.find(([url]) =>
      String(url).includes('/productos') && !String(url).includes('historial-precios'),
    );
    expect(String(productosCall?.[0])).toContain('/salones/1/productos?page=1&limit=12');
  });

  it('crear producto: llena el modal (modo margen) y hace POST', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo Producto' }, WAIT));

    expect(await screen.findByText('Nuevo Producto', {}, WAIT)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: Shampoo profesional'), {
      target: { value: 'Acondicionador' },
    });
    // En modo margen: [0] precio de compra (MoneyInput)
    const moneyInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(moneyInputs[0], { target: { value: '10000' } });

    // El margen por defecto (30%) sugiere precio de venta 13.000 → habilita el botón
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/productos',
        expect.objectContaining({
          nombre: 'Acondicionador',
          precioCompra: 10000,
          margenGanancia: 30,
          cantidadStock: 0,
          stockMinimo: 0,
          tipoInventario: 'RETAIL',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Nuevo Producto')).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);

  it('editar producto: precarga los campos y Guardar hace PUT', async () => {
    defaultApiMock();
    mockPut.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, WAIT));

    expect(await screen.findByText('Editar Producto', {}, WAIT)).toBeInTheDocument();

    // Precarga: nombre, precio de compra formateado y marca
    expect(screen.getByDisplayValue('Shampoo Profesional')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20.000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Loreal')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Shampoo Profesional'), {
      target: { value: 'Shampoo Premium' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/salones/1/productos/1',
        expect.objectContaining({
          nombre: 'Shampoo Premium',
          precioCompra: 20000,
          margenGanancia: 30,
          cantidadStock: 15,
          stockMinimo: 5,
          tipoInventario: 'RETAIL',
        }),
      );
    });
  }, 20000);

  it('crear producto con escáner: envía el codigoBarras en el POST', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo Producto' }, WAIT));
    expect(await screen.findByText('Nuevo Producto', {}, WAIT)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: Shampoo profesional'), {
      target: { value: 'Crema de peinar' },
    });
    // El campo de código de barras acepta el scan (texto + Enter del lector)
    fireEvent.change(screen.getByPlaceholderText('Escaneá o escribí el código'), {
      target: { value: '7709876543210' },
    });
    // En modo margen: [0] precio de compra (MoneyInput)
    const moneyInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(moneyInputs[0], { target: { value: '10000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/productos',
        expect.objectContaining({ codigoBarras: '7709876543210' }),
      );
    });
  }, 20000);

  it('editar producto: precarga el codigoBarras y lo conserva en el PUT', async () => {
    defaultApiMock();
    mockPut.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, WAIT));
    expect(await screen.findByText('Editar Producto', {}, WAIT)).toBeInTheDocument();

    // El código escaneado al crear queda precargado en el formulario
    expect(screen.getByDisplayValue('7701234567890')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/salones/1/productos/1',
        expect.objectContaining({ codigoBarras: '7701234567890' }),
      );
    });
  }, 20000);

  it('editar producto: vaciar el campo de código envía "" para limpiarlo en el backend', async () => {
    defaultApiMock();
    mockPut.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, WAIT));
    expect(await screen.findByText('Editar Producto', {}, WAIT)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('7701234567890'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/salones/1/productos/1',
        expect.objectContaining({ codigoBarras: '' }),
      );
    });
  }, 20000);

  it('restock por escáner: buscar por código consulta la API con q', async () => {
    defaultApiMock();

    renderPage();

    expect(await screen.findByText('Shampoo Profesional', {}, WAIT)).toBeInTheDocument();

    // Un lector de código de barras "escribe" los dígitos + Enter en el buscador
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, marca o código…'), {
      target: { value: '7701234567890' },
    });

    await waitFor(() => {
      const productosCalls = mockGet.mock.calls.filter(
        ([url]) => String(url).includes('/productos') && !String(url).includes('historial-precios'),
      );
      const last = productosCalls[productosCalls.length - 1];
      expect(String(last?.[0])).toContain('q=7701234567890');
    }, WAIT);
  }, 20000);

  it('re-stock: confirma y hace POST al endpoint /restock con cantidad y precio', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Re-stock inteligente' }, WAIT));

    expect(await screen.findByText('Re-stock inteligente', {}, WAIT)).toBeInTheDocument();
    // El número de stock va dentro de un <strong>, el texto del párrafo se parte
    expect(screen.getByText(/Stock actual:/)).toBeInTheDocument();
    // "15" aparece en la fila de la tabla y en el modal de re-stock
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(2);

    // Inputs del modal: [0] cantidad, [1] nuevo precio de compra
    const stockInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(stockInputs[0], { target: { value: '10' } });
    fireEvent.change(stockInputs[1], { target: { value: '18000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar re-stock' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/productos/1/restock', {
        cantidad: 10,
        precioCompra: 18000,
      });
    });
  }, 20000);

  it('historial: abre el modal y consulta el endpoint de historial de precios', async () => {
    defaultApiMock();

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Historial' }, WAIT));

    expect(
      await screen.findByText('Historial de precios — Shampoo Profesional', {}, WAIT),
    ).toBeInTheDocument();

    // Los datos del historial se muestran (cantidad agregada, precio venta, stock final)
    expect(screen.getByText('10')).toBeInTheDocument(); // cantidadAgregada
    expect(screen.getByText('$ 23.400')).toBeInTheDocument(); // precioVenta del historial
    expect(screen.getByText('25')).toBeInTheDocument(); // stockDespues

    const historialCall = mockGet.mock.calls.find(([url]) =>
      String(url).includes('historial-precios'),
    );
    expect(String(historialCall?.[0])).toContain('/salones/1/productos/1/historial-precios');
  }, 20000);

  it('muestra la paginación y navega a la página 2', async () => {
    defaultApiMock([producto], 25);

    renderPage();

    expect(await screen.findByText('Shampoo Profesional', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3 (25 productos)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    await waitFor(() => {
      const productosCalls = mockGet.mock.calls.filter(
        ([url]) => String(url).includes('/productos') && !String(url).includes('historial-precios'),
      );
      const last = productosCalls[productosCalls.length - 1];
      expect(String(last?.[0])).toContain('/salones/1/productos?page=2&limit=12');
    });
  }, 20000);

  it('eliminar producto: confirmación y DELETE', async () => {
    defaultApiMock();
    mockDelete.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }, WAIT));

    expect(await screen.findByText(/¿Eliminar producto\?/i, {}, WAIT)).toBeInTheDocument();

    const eliminarButtons = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(eliminarButtons[eliminarButtons.length - 1]);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/salones/1/productos/1');
    });
  }, 20000);
});

describe('ProductosPage — móvil (grid apilado ≤640px)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
    setMobileMedia(true);
  });

  const ROW_LABELS = ['Nombre', 'Stock', 'P. Compra', 'P. Venta', 'Margen', 'Precio', 'Tipo', 'Marca', 'Código', 'Acciones'];

  it('cada celda de fila expone su data-label en orden (contrato de grids apilados)', async () => {
    defaultApiMock([
      producto,
      { ...producto, id: 2, nombre: 'Cera Modeladora', marca: 'Wella', precioVenta: 18000, margenGanancia: 20, cantidadStock: 3, stockMinimo: 5 },
    ]);

    renderPage();

    // Esperar a que las filas de datos rendericen (no el skeleton)
    await screen.findByText('Shampoo Profesional', {}, WAIT);
    await screen.findByText('Cera Modeladora', {}, WAIT);
    const rows = [screen.getByText('Shampoo Profesional'), screen.getByText('Cera Modeladora')].map(
      (cell) => cell.parentElement as HTMLElement,
    );
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      const cells = row.querySelectorAll('[data-label]');
      expect(cells).toHaveLength(ROW_LABELS.length);
      cells.forEach((cell, i) => {
        expect(cell).toHaveAttribute('data-label', ROW_LABELS[i]);
      });
    });
  });

  it('el modal de crear producto usa las clases bottom-sheet en móvil (D10)', async () => {
    defaultApiMock();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo Producto' }, WAIT));

    const overlay = document.querySelector('.mobileBottomSheet');
    const panel = document.querySelector('.mobileBottomSheetContent');
    expect(overlay).not.toBeNull();
    expect(panel).not.toBeNull();
    // El panel con la clase bottom-sheet es el modal real, con su título
    expect(within(panel as HTMLElement).getByText('Nuevo Producto')).toBeInTheDocument();
  });
});
