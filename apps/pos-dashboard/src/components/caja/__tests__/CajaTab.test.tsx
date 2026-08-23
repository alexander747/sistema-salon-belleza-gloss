import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Rol, type IUser } from '@pos-final/types';
import { setMobileMedia } from '../../../test/setMobileMedia';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

import CajaTab from '../CajaTab';
import { getColombiaDateString } from '../CajaBanner';

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

/** Mock por defecto: sin caja abierta, sin cierres y sin abiertas. */
function defaultApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/caja/actual/esperado')) {
      return Promise.resolve({ data: { ok: true, data: reporteEsperado } });
    }
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('estado=ABIERTA')) {
      return Promise.resolve({
        data: {
          ok: true,
          data: { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } },
        },
      });
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
      expect(mockPost).toHaveBeenCalledWith('/salones/1/caja/abrir', {
        montoInicial: 50000,
        fechaCaja: getColombiaDateString(),
      });
    });
    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'caja-refresh' }));
  });

  it('abre caja de fecha pasada: date input default hoy, seleccionar 16/08 → POST con fechaCaja', async () => {
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

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));

    // El date input del modal Abrir tiene default = hoy (Colombia)
    const fechaInput = await screen.findByLabelText(/fecha de apertura/i);
    expect(fechaInput).toHaveValue(getColombiaDateString());

    fireEvent.change(screen.getByLabelText(/monto inicial/i), { target: { value: '50000' } });
    fireEvent.change(fechaInput, { target: { value: '2026-08-16' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/caja/abrir', {
        montoInicial: 50000,
        fechaCaja: '2026-08-16',
      });
    });
    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
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

  it('muestra botón "Reabrir caja" cuando la caja de HOY está CERRADA (y NO muestra "Abrir")', async () => {
    const cierreHoy = { ...cierre, id: 9, fechaCaja: getColombiaDateString() };
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierreHoy], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByRole('button', { name: 'Reabrir caja' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
  });

  it('muestra "Abrir" (no "Reabrir caja") cuando el último cierre es de un día anterior', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierre], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByRole('button', { name: 'Abrir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir caja' })).not.toBeInTheDocument();
  });

  it('reabre la caja: confirm + POST /caja/reabrir → estado ABIERTA + caja-refresh', async () => {
    const cierreHoy = { ...cierre, id: 9, fechaCaja: getColombiaDateString() };
    const cajaReabierta = { ...cajaAbierta, id: 9, fechaCaja: getColombiaDateString() };
    let abierta = false;
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) {
        return abierta
          ? Promise.resolve({ data: { ok: true, data: cajaReabierta } })
          : Promise.reject(error404);
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierreHoy], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/caja/reabrir')) {
        abierta = true;
        return Promise.resolve({ data: { ok: true, data: cajaReabierta } });
      }
      return Promise.resolve({ data: { ok: true, data: {} } });
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const spy = vi.spyOn(window, 'dispatchEvent');

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir caja' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/caja/reabrir');
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'caja-refresh' }));
  });

  it('no llama POST /caja/reabrir si el usuario cancela la confirmación', async () => {
    const cierreHoy = { ...cierre, id: 9, fechaCaja: getColombiaDateString() };
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierreHoy], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir caja' }));

    await waitFor(() => {
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  it('muestra error visible cuando reabrir responde 409 CAJA_YA_ABIERTA', async () => {
    const cierreHoy = { ...cierre, id: 9, fechaCaja: getColombiaDateString() };
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierreHoy], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    mockPost.mockRejectedValue({
      response: {
        status: 409,
        data: { ok: false, error: { code: 'CAJA_YA_ABIERTA', message: 'Ya existe una caja abierta' } },
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir caja' }));

    expect(await screen.findByText(/ya está abierta/i)).toBeInTheDocument();
  });

  it('muestra error visible cuando reabrir responde 404 CAJA_NO_ABIERTA', async () => {
    const cierreHoy = { ...cierre, id: 9, fechaCaja: getColombiaDateString() };
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierreHoy], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    mockPost.mockRejectedValue({
      response: {
        status: 404,
        data: { ok: false, error: { code: 'CAJA_NO_ABIERTA', message: 'No hay caja abierta' } },
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir caja' }));

    expect(await screen.findByText(/no hay caja de hoy/i)).toBeInTheDocument();
  });

  it('abre el detalle del cierre al hacer clic en "Ver": muestra loading, luego modal con reporte y movimientos', async () => {
    let resolveDetail!: (value: unknown) => void;
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/1/cierre')) {
        return new Promise((res) => {
          resolveDetail = res;
        });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierre], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/1/cierre');
    });
    // Estado de carga mientras llega la respuesta
    expect(await screen.findByText(/cargando detalle/i)).toBeInTheDocument();

    resolveDetail({
      data: {
        ok: true,
        data: {
          caja: cierre,
          reporte: { ...reporteEsperado, montoReal: 170000, diferencia: 0 },
          movimientos: [
            {
              id: 1,
              tipo: 'SERVICIO',
              fecha: '2026-08-15T14:00:00.000Z',
              descripcion: 'Manicure',
              monto: 120000,
              metodoPago: 'EFECTIVO',
            },
            {
              id: 9,
              tipo: 'GASTO',
              fecha: '2026-08-15',
              descripcion: 'Insumos',
              monto: 10000,
              metodoPago: 'EFECTIVO',
            },
          ],
        },
      },
    });

    // Modal con reporte del arqueo + tabla de movimientos (SERVICIO y GASTO)
    const modal = await screen.findByTestId('detalle-cierre-modal');
    expect(within(modal).getByText(/detalle del cierre/i)).toBeInTheDocument();
    expect(within(modal).getByText(/140\.000/)).toBeInTheDocument(); // montoEsperado
    // 170.000 aparece como ingresosBrutos y como montoReal del arqueo
    expect(within(modal).getAllByText(/170\.000/).length).toBeGreaterThanOrEqual(1);
    expect(within(modal).getByText('SERVICIO')).toBeInTheDocument();
    expect(within(modal).getByText('GASTO')).toBeInTheDocument();
    expect(within(modal).getByText('Manicure')).toBeInTheDocument();
    expect(within(modal).getByText('Insumos')).toBeInTheDocument();
    // 120.000 aparece como totalServicios y como monto del movimiento; 10.000 como totalGastos y monto del gasto
    expect(within(modal).getAllByText(/120\.000/).length).toBeGreaterThanOrEqual(1);
    expect(within(modal).getAllByText(/10\.000/).length).toBeGreaterThanOrEqual(1);

    // Cerrar el modal (AnimatePresence anima la salida → esperar a que se desmonte)
    fireEvent.click(within(modal).getByRole('button', { name: /listo/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('detalle-cierre-modal')).not.toBeInTheDocument();
    });
  });

  it('muestra mensaje de error cuando el detalle del cierre no se puede cargar', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/1/cierre')) {
        return Promise.reject(new Error('network'));
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cierre], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));

    const modal = await screen.findByTestId('detalle-cierre-modal');
    expect(await within(modal).findByText(/no se pudo cargar/i)).toBeInTheDocument();
  });
});

describe('CajaTab — historial completo (ABIERTA + CERRADA)', () => {
  const cajaAbiertaHoy = { ...cajaAbierta, id: 7, fechaCaja: getColombiaDateString() };

  const emptyAbiertas = {
    data: { ok: true, data: { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } } },
  };

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('renderiza lista mixta: badges ABIERTA y CERRADA, y "—" en la fila ABIERTA (sin arqueo falso)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('estado=ABIERTA')) return Promise.resolve(emptyAbiertas);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: {
              data: [cajaAbierta, cierre],
              meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
            },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
    expect(screen.getByText('CERRADA')).toBeInTheDocument();
    // Fila ABIERTA: cerrada por, esperado, real y diferencia → "—" (no $0 fabricado)
    expect(screen.getAllByText('—')).toHaveLength(4);
    // La fila CERRADA conserva sus montos del arqueo
    expect(screen.getAllByText(/170\.000/).length).toBeGreaterThanOrEqual(1);
  });

  it('muestra aviso "caja pendiente de cierre" con count cuando hay una ABIERTA de un día anterior', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/5/cierre')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { caja: cajaAbierta, reporte: reporteEsperado, movimientos: [] },
          },
        });
      }
      if (url.includes('estado=ABIERTA')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbierta], meta: { page: 1, limit: 0, total: 1, totalPages: 1 } },
          },
        });
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

    // El aviso usa el fetch dedicado (count exacto aunque el historial esté paginado)
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/cierres?estado=ABIERTA&limit=0');
    });

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/Hay 1 caja/);
    expect(banner).toHaveTextContent(/pendientes de cierre/i);
    // Historial vacío → empty state nuevo
    expect(screen.getByText('Sin cajas registradas.')).toBeInTheDocument();

    // El botón Ver del aviso abre el detalle de la caja pendiente más reciente
    fireEvent.click(within(banner).getByRole('button', { name: 'Ver' }));
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/5/cierre');
    });
  });

  it('NO muestra aviso de pendientes cuando la única ABIERTA es de hoy', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('estado=ABIERTA')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbiertaHoy], meta: { page: 1, limit: 0, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbiertaHoy], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/cierres?estado=ABIERTA&limit=0');
    });
    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
    expect(screen.queryByText(/pendientes de cierre/i)).not.toBeInTheDocument();
  });

  it('ofrece "Reabrir caja" con caja de hoy CERRADA + huérfana ABIERTA en el historial (lista mixta)', async () => {
    const cierreHoy = { ...cierre, id: 9, fechaCaja: getColombiaDateString() };
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('estado=ABIERTA')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbierta], meta: { page: 1, limit: 0, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: {
              data: [cierreHoy, cajaAbierta],
              meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
            },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByRole('button', { name: 'Reabrir caja' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
  });

  it('abre el detalle de una caja ABIERTA: badge ABIERTA y arqueo con "—" (null-safe)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('estado=ABIERTA')) return Promise.resolve(emptyAbiertas);
      if (url.includes('/caja/5/cierre')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: {
              caja: cajaAbierta,
              reporte: { ...reporteEsperado, montoReal: null, diferencia: null },
              movimientos: [
                {
                  id: 1,
                  tipo: 'SERVICIO',
                  fecha: '2026-08-16T14:00:00.000Z',
                  descripcion: 'Manicure',
                  monto: 120000,
                  metodoPago: 'EFECTIVO',
                },
              ],
            },
          },
        });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbierta], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));

    const modal = await screen.findByTestId('detalle-cierre-modal');
    // Badge dinámico: la caja abierta se muestra como ABIERTA, no CERRADA hardcodeado
    expect(within(modal).getByText('ABIERTA')).toBeInTheDocument();
    // Arqueo sin fabricar: montoReal y diferencia → "—" (no $0)
    expect(within(modal).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    // Los movimientos de la caja abierta siguen presentes
    expect(within(modal).getByText('Manicure')).toBeInTheDocument();
  });
});

describe('CajaTab — móvil (modales bottom-sheet, D10)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    setMobileMedia(true);
  });

  it('el modal de abrir caja usa las clases bottom-sheet en móvil (D10)', async () => {
    defaultApiMock();

    render(<CajaTab salonId={1} user={duena} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));

    const overlay = await waitFor(() => document.querySelector('.mobileBottomSheet'));
    const panel = document.querySelector('.mobileBottomSheetContent');
    expect(overlay).not.toBeNull();
    expect(panel).not.toBeNull();
  });
});

describe('CajaTab — cerrar por id y gate de Abrir (huérfanas)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('muestra "Cerrar" SOLO en filas ABIERTA del historial (la CERRADA solo "Ver")', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('estado=ABIERTA')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: {
              data: [cajaAbierta, cierre],
              meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
            },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(<CajaTab salonId={1} user={duena} />);

    expect(await screen.findByText('ABIERTA')).toBeInTheDocument();
    // 2 filas: ABIERTA (Ver+Cerrar) y CERRADA (solo Ver)
    expect(screen.getAllByRole('button', { name: 'Ver' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Cerrar' })).toHaveLength(1);
  });

  it('cierra una huérfana desde el historial: click "Cerrar" → modal con esperado de ESA caja → POST {cajaId, montoRealEfectivo}', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('estado=ABIERTA')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/caja/5/cierre')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { caja: cajaAbierta, reporte: reporteEsperado, movimientos: [] },
          },
        });
      }
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbierta], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
          },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/caja/cerrar')) {
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

    // El historial trae la huérfana ABIERTA → botón Cerrar de la fila (único: sin aviso)
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));

    // Prefill: esperado de ESA caja vía GET /caja/:id/cierre
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/5/cierre');
    });
    expect(await screen.findByText(/efectivo esperado/i)).toBeInTheDocument();
    expect(screen.getByText(/140\.000/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/monto real/i), { target: { value: '135000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    // POST con cajaId de ESA caja
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/caja/cerrar', {
        montoRealEfectivo: 135000,
        cajaId: 5,
      });
    });
    // Reporte de cierre visible
    expect(await screen.findByTestId('reporte-cierre-modal')).toBeInTheDocument();
  });

  it('oculta "Abrir" y muestra el mensaje pendiente cuando existe una huérfana ABIERTA', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('estado=ABIERTA')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbierta], meta: { page: 1, limit: 0, total: 1, totalPages: 1 } },
          },
        });
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

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(screen.getByText(/No se puede abrir: hay una caja abierta pendiente de cierre/)).toBeInTheDocument();
  });

  it('el aviso de pendientes ofrece "Cerrar" junto a "Ver" para la huérfana más reciente', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/5/cierre')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { caja: cajaAbierta, reporte: reporteEsperado, movimientos: [] },
          },
        });
      }
      if (url.includes('estado=ABIERTA')) {
        return Promise.resolve({
          data: {
            ok: true,
            data: { data: [cajaAbierta], meta: { page: 1, limit: 0, total: 1, totalPages: 1 } },
          },
        });
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

    const banner = await screen.findByRole('alert');
    // El aviso lista la huérfana: "Ver" (detalle) + "Cerrar" (arqueo por id)
    expect(within(banner).getByRole('button', { name: 'Ver' })).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/5/cierre');
    });
    expect(await screen.findByText(/efectivo esperado/i)).toBeInTheDocument();
  });
});
