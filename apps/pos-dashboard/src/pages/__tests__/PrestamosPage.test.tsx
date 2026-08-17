import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost, delete: mockDelete },
}));

import PrestamosPage from '../PrestamosPage';

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

const prestamoEmpleada = {
  id: 1,
  salonId: 1,
  usuarioId: 1,
  nombreEmpleado: 'María Torres',
  nombreTercero: null,
  monto: 200000,
  saldoPendiente: 150000,
  motivo: 'Adelanto de sueldo',
  estado: 'ACTIVO',
  fechaCreacion: '2026-08-01T12:00:00',
  creadoEn: '2026-08-01T12:00:00',
  actualizadoEn: '2026-08-01T12:00:00',
};

const prestamoTercero = {
  id: 2,
  salonId: 1,
  usuarioId: null,
  nombreEmpleado: null,
  nombreTercero: 'Luis Ramírez',
  monto: 100000,
  saldoPendiente: 0,
  motivo: null,
  estado: 'PAGADO',
  fechaCreacion: '2026-07-15T12:00:00',
  creadoEn: '2026-07-15T12:00:00',
  actualizadoEn: '2026-07-15T12:00:00',
};

function defaultApiMock(prestamos: unknown[] = [prestamoEmpleada, prestamoTercero]) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/superadmin/salones')) return Promise.resolve({ data: [] });
    if (url.includes('/empleadas')) {
      return Promise.resolve({ data: [{ id: 1, nombre: 'María Torres' }] });
    }
    if (url.includes('/prestamos/')) {
      // Detalle de préstamo (GET /salones/0/prestamos/:id)
      return Promise.resolve({ data: { ...prestamoEmpleada, pagos: [] } });
    }
    if (url.includes('/prestamos')) {
      return Promise.resolve({ data: { data: prestamos, meta: { page: 1, limit: 100, total: prestamos.length, totalPages: 1 } } });
    }
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/prestamos']}>
      <PrestamosPage />
    </MemoryRouter>,
  );
}

const WAIT = { timeout: 4000 };

describe('PrestamosPage — listado, creación, pagos y cancelación', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  it('lista préstamos de empleada y tercero con montos, saldo y estado', async () => {
    defaultApiMock();

    renderPage();

    expect(await screen.findByText('María Torres', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Luis Ramírez')).toBeInTheDocument();
    expect(screen.getByText('$ 200.000')).toBeInTheDocument(); // monto empleada
    // saldo pendiente: en la fila (150.000) y en la tarjeta de resumen (150.000 + 0)
    expect(screen.getAllByText('$ 150.000').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('ACTIVO')).toBeInTheDocument();
    expect(screen.getByText('PAGADO')).toBeInTheDocument();
    expect(screen.getByText('Adelanto de sueldo')).toBeInTheDocument();
    expect(screen.getByText('Sin motivo')).toBeInTheDocument();

    // Resumen: 2 préstamos, 1 activo
    expect(screen.getByText('Total préstamos')).toBeInTheDocument();
    expect(screen.getByText('Préstamos activos')).toBeInTheDocument();
  });

  it('crear préstamo a empleada: selecciona deudor, monto y hace POST', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo préstamo' }, WAIT));

    expect(await screen.findByText('Nuevo préstamo', {}, WAIT)).toBeInTheDocument();

    // Tipo empleado por defecto: el select del modal es el último combobox (el 1º es el SalonSwitcher)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[selects.length - 1], { target: { value: '1' } });

    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '200000' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Adelanto de sueldo'), {
      target: { value: 'Emergencia' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear préstamo' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/0/prestamos', {
        usuarioId: 1,
        nombreTercero: null,
        monto: 200000,
        motivo: 'Emergencia',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Nuevo préstamo')).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);

  it('crear préstamo a tercero: radio Tercero y POST con nombreTercero', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo préstamo' }, WAIT));

    fireEvent.click(await screen.findByLabelText('Tercero', {}, WAIT));

    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'Juan Pérez' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '80000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear préstamo' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/0/prestamos', {
        usuarioId: null,
        nombreTercero: 'Juan Pérez',
        monto: 80000,
        motivo: undefined,
      });
    });
  }, 20000);

  it('pagos: abre el modal con historial y registra un pago manual', async () => {
    defaultApiMock();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/superadmin/salones')) return Promise.resolve({ data: [] });
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'María Torres' }] });
      }
      if (url.includes('/prestamos/')) {
        return Promise.resolve({
          data: {
            ...prestamoEmpleada,
            pagos: [
              { id: 10, prestamoId: 1, monto: 50000, fechaPago: '2026-08-05T12:00:00', tipoPago: 'MANUAL', liquidacionId: null, observacion: 'Abono efectivo', creadoEn: '2026-08-05T12:00:00' },
            ],
          },
        });
      }
      if (url.includes('/prestamos')) {
        return Promise.resolve({ data: { data: [prestamoEmpleada, prestamoTercero], meta: { page: 1, limit: 100, total: 2, totalPages: 1 } } });
      }
      return Promise.resolve({ data: {} });
    });
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    // Hay un botón "Pagos" por fila (2 préstamos): usar el primero
    const pagosButtons = await screen.findAllByRole('button', { name: 'Pagos' }, WAIT);
    fireEvent.click(pagosButtons[0]);

    // Modal con saldo pendiente y el historial (pago previo de 50.000)
    expect(await screen.findByText('Pagos — María Torres', {}, WAIT)).toBeInTheDocument();
    // saldo pendiente: tarjeta resumen + fila + modal
    expect(screen.getAllByText('$ 150.000').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('$ 50.000')).toBeInTheDocument(); // pago del historial
    expect(screen.getByText('Abono efectivo')).toBeInTheDocument();

    // Registrar pago manual: el monto viene precargado con el saldo (150.000)
    const montoPagoInput = screen.getByDisplayValue('150.000');
    fireEvent.change(montoPagoInput, { target: { value: '50000' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Pago en efectivo'), {
      target: { value: 'Pago en efectivo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/0/prestamos/1/pagos', {
        monto: 50000,
        observacion: 'Pago en efectivo',
      });
    });
  }, 20000);

  it('cancelar préstamo: solo para ACTIVO y DELETE tras confirmar', async () => {
    defaultApiMock();
    mockDelete.mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    // Solo el préstamo ACTIVO tiene botón Cancelar (el PAGADO no)
    const cancelarButtons = await screen.findAllByRole('button', { name: 'Cancelar' }, WAIT);
    expect(cancelarButtons).toHaveLength(1);

    fireEvent.click(cancelarButtons[0]);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/salones/0/prestamos/1');
    });
    expect(window.confirm).toHaveBeenCalled();
  }, 20000);

  it('muestra la paginación client-side con 15 préstamos', async () => {
    const muchos = Array.from({ length: 15 }, (_, i) => ({
      ...prestamoEmpleada,
      id: i + 1,
      nombreEmpleado: `Empleada ${i + 1}`,
      monto: 50000,
      saldoPendiente: 50000,
    }));
    defaultApiMock(muchos);

    renderPage();

    expect(await screen.findByText('Empleada 1', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2 (15 préstamos)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    expect(await screen.findByText('Empleada 13', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText('Empleada 1')).not.toBeInTheDocument();
  }, 20000);
});
