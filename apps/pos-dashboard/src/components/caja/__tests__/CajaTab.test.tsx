import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

import CajaTab from '../CajaTab';

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

const manicurista: IUser = { ...duena, id: 4, rol: Rol.MANICURISTA };

const cajaAbierta = {
  id: 5,
  salonId: 1,
  fechaCaja: '2026-08-16',
  montoInicial: 50000,
  montoEsperado: null,
  montoRealEfectivo: null,
  diferencia: null,
  estado: 'ABIERTA',
  aperturaPorId: 2,
  aperturaEn: '2026-08-16T13:00:00.000Z',
  cierrePorId: null,
  cierreEn: null,
  creadoEn: '2026-08-16T13:00:00.000Z',
};

const cierre = {
  ...cajaAbierta,
  id: 1,
  fechaCaja: '2026-08-15',
  estado: 'CERRADA',
  montoEsperado: 170000,
  montoRealEfectivo: 170000,
  diferencia: 0,
  cierrePorId: 2,
  cierreEn: '2026-08-15T22:00:00.000Z',
};

const reporteEsperado = {
  totalServicios: 120000,
  totalProductos: 50000,
  ingresosBrutos: 170000,
  descuentos: 0,
  ingresosNetos: 170000,
  porMetodoPago: { EFECTIVO: 150000, TARJETA: 20000, TRANSFERENCIA: 0 },
  comisiones: 30000,
  totalGastos: 10000,
  montoEsperado: 140000,
  montoReal: null,
  diferencia: null,
  cantidadMovimientos: 3,
};

const error404 = {
  response: {
    status: 404,
    data: { ok: false, error: { code: 'CAJA_NO_ABIERTA', message: 'No hay caja abierta' } },
  },
};

/** Mock por defecto: sin caja abierta y sin cierres. */
function defaultApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/caja/actual/esperado')) {
      return Promise.resolve({ data: { ok: true, data: reporteEsperado } });
    }
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('/caja/cierres')) {
      return Promise.resolve({
        data: {
          ok: true,
          data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } },
        },
      });
    }
    if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  });
}

describe('CajaTab', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('muestra estado "Caja cerrada" y botón Abrir cuando no hay caja abierta (rol con permiso)', async () => {
    defaultApiMock();

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByText(/Caja cerrada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/actual');
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/cierres?page=1&limit=12');
  });

  it('muestra badge ABIERTA con monto inicial y botón Cerrar cuando hay caja abierta', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) {
        return Promise.resolve({ data: { ok: true, data: cajaAbierta } });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('oculta Abrir/Cerrar para roles sin permiso (MANICURISTA)', async () => {
    defaultApiMock();

    render(<CajaTab salonId={1} user={manicurista} />);

    expect(await screen.findByText(/Caja cerrada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });

  it('abre la caja: modal con montoInicial → POST /caja/abrir → badge ABIERTA + caja-refresh', async () => {
    // La caja pasa de cerrada → abierta tras el POST (refleja el backend real)
    let abierta = false;
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) {
        return abierta
          ? Promise.resolve({ data: { ok: true, data: cajaAbierta } })
          : Promise.reject(error404);
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/caja/abrir')) {
        abierta = true;
        return Promise.resolve({ data: { ok: true, data: cajaAbierta } });
      }
      return Promise.resolve({ data: { ok: true, data: {} } });
    });
    const spy = vi.spyOn(window, 'dispatchEvent');

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));

    expect(await screen.findByLabelText(/monto inicial/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/monto inicial/i), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/caja/abrir', { montoInicial: 50000 });
    });
    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'caja-refresh' }));
  });

  it('cierra la caja: modal arqueo con esperado, input montoReal, diferencia en vivo y POST /caja/cerrar', async () => {
    // La caja pasa de abierta → cerrada tras el POST (refleja el backend real)
    let cerrada = false;
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual/esperado')) {
        return Promise.resolve({ data: { ok: true, data: reporteEsperado } });
      }
      if (url.includes('/caja/actual')) {
        return cerrada
          ? Promise.reject(error404)
          : Promise.resolve({ data: { ok: true, data: cajaAbierta } });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/caja/cerrar')) {
        cerrada = true;
        return Promise.resolve({
          data: {
            ok: true,
            data: {
              caja: {
                ...cajaAbierta,
                estado: 'CERRADA',
                montoEsperado: 140000,
                montoRealEfectivo: 135000,
                diferencia: -5000,
                cierrePorId: 2,
                cierreEn: '2026-08-16T22:00:00.000Z',
              },
              reporte: { ...reporteEsperado, montoReal: 135000, diferencia: -5000 },
            },
          },
        });
      }
      return Promise.resolve({ data: { ok: true, data: {} } });
    });

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));

    // El modal arqueo muestra el esperado (efectivo) y el desglose por método
    expect(await screen.findByText(/efectivo esperado/i)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/actual/esperado');
    expect(await screen.findByText(/140\.000/)).toBeInTheDocument();
    expect(screen.getByText(/150\.000/)).toBeInTheDocument(); // EFECTIVO breakdown

    // Diferencia en vivo: real 135000 - esperado 140000 = -5000
    fireEvent.change(screen.getByLabelText(/monto real/i), { target: { value: '135000' } });
    expect(await screen.findByText(/-\$\s*5\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/caja/cerrar', { montoRealEfectivo: 135000 });
    });

    // Tras cerrar se muestra el reporte con esperado/real/diferencia
    // (scoped al modal del reporte: el modal de arqueo aún está saliendo con AnimatePresence)
    const reporteModal = await screen.findByTestId('reporte-cierre-modal');
    expect(within(reporteModal).getByText(/reporte de cierre/i)).toBeInTheDocument();
    expect(within(reporteModal).getByText(/140\.000/)).toBeInTheDocument();
    expect(within(reporteModal).getByText(/135\.000/)).toBeInTheDocument();
    expect(within(reporteModal).getByText(/-\$\s*5\.000/)).toBeInTheDocument();
  });

  it('renderiza el historial de cierres paginado con fecha, montos y estado', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: {
              data: [cierre],
              meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
            },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByText(/15\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText('CERRADA')).toBeInTheDocument();
    // 170.000 aparece como montoEsperado y como montoReal del cierre
    expect(screen.getAllByText(/170\.000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
  });

  it('navega páginas del historial con los controles de paginación', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: {
              data: [cierre],
              meta: { page: 1, limit: 12, total: 2, totalPages: 2 },
            },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    const nextBtn = await screen.findByRole('button', { name: /siguiente/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/cierres?page=2&limit=12');
    });
  });
});
