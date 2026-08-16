import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

const { mockCreateObjectURL, mockRevokeObjectURL } = vi.hoisted(() => ({
  mockCreateObjectURL: vi.fn(),
  mockRevokeObjectURL: vi.fn(),
}));

beforeAll(() => {
  URL.createObjectURL = mockCreateObjectURL;
  URL.revokeObjectURL = mockRevokeObjectURL;
  // jsdom no navega con <a download>; spiar click para verificar el disparo
  HTMLAnchorElement.prototype.click = vi.fn();
});

import FinanzasPage from '../FinanzasPage';

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

const manicurista: IUser = {
  ...duena,
  id: 4,
  nombre: 'Manicurista Test',
  email: 'manicurista@test.com',
  rol: Rol.MANICURISTA,
};

const error404 = {
  response: {
    status: 404,
    data: { ok: false, error: { code: 'CAJA_NO_ABIERTA', message: 'No hay caja abierta' } },
  },
};

/** Mock genérico: los tabs existentes responden vacío y la caja está cerrada. */
function defaultApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('/caja/cierres')) {
      return Promise.resolve({
        data: { ok: true, data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } },
      });
    }
    if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
    if (url.includes('/clientes')) return Promise.resolve({ data: [] });
    if (url.includes('/registros')) {
      return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
    }
    if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/finanzas']}>
      <FinanzasPage />
    </MemoryRouter>,
  );
}

describe('FinanzasPage — tab Caja', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('agrega el tab "💰 Caja" a la navegación', async () => {
    defaultApiMock();

    renderPage();

    expect(await screen.findByRole('button', { name: '💰 Caja' })).toBeInTheDocument();
  });

  it('renderiza CajaTab al activar el tab Caja (badge Caja cerrada + botón Abrir)', async () => {
    defaultApiMock();

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '💰 Caja' }));

    expect(await screen.findByText(/caja cerrada/i)).toBeInTheDocument();
    // Abrir aparece en el CajaBanner y en el CajaTab cuando la caja está cerrada
    expect(screen.getAllByRole('button', { name: 'Abrir' }).length).toBeGreaterThanOrEqual(1);
  });

  it('monta el CajaBanner sobre el contenido de FinanzasPage', async () => {
    defaultApiMock();

    renderPage();

    // El banner consulta el estado de caja al montar
    expect(await screen.findByText(/caja cerrada — abrir para vender/i)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/actual');
  });

  it('los tabs existentes siguen funcionando (Registros sigue presente)', async () => {
    defaultApiMock();

    renderPage();

    expect(await screen.findByRole('button', { name: '📋 Registros' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '📋 Registros' }));
    // El estado vacío del tab Registros confirma que el contenido del tab sigue montándose
    expect(await screen.findByText(/no hay registros para este período/i)).toBeInTheDocument();
  });
});

describe('FinanzasPage — tab Reportes (P&L mensual)', () => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const pylData = {
    desde: '2026-05-01',
    hasta: '2026-05-31',
    cantidadAtenciones: 3,
    ingresosBrutos: 350000,
    descuentos: 35000,
    ingresosNetos: 315000,
    totalServicios: 270000,
    totalProductos: 45000,
    propinas: 15000,
    costoBaseInsumos: 60000,
    margenBruto: 255000,
    comisiones: 48000,
    gastosFijos: 200000,
    gastosOperativos: 80000,
    gastosPorCategoria: { ARRIENDO: 200000, SERVICIOS_PUBLICOS: 80000 },
    totalGastos: 280000,
    devoluciones: 20000,
    utilidadNeta: -93000,
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(n)
      // getByText normaliza el texto del nodo (NBSP → espacio) pero compara
      // contra el matcher sin normalizar: usar espacio regular en el esperado.
      .replace(/\u00a0/g, ' ');

  const getPylCall = () =>
    mockGet.mock.calls.find(([url]) => String(url).includes('/finanzas/pyl'));

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  async function openReportesTab(mockImpl: (url: string) => Promise<unknown>) {
    mockGet.mockImplementation(mockImpl);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '📊 Reportes' }));
    // Esperar a que el tab dispare las llamadas de reporte
    await waitFor(() => expect(getPylCall()).toBeTruthy());
  }

  it('envía desde y hasta al pedir el P&L (y no rompe el ROI)', async () => {
    await openReportesTab((url) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/pyl')) return Promise.resolve({ data: pylData });
      if (url.includes('/finanzas/roi')) {
        return Promise.resolve({
          data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    const pylCall = getPylCall()!;
    expect(pylCall[1].params).toEqual({ desde: todayStr, hasta: todayStr });
  });

  it('renderiza las tarjetas del P&L con los valores de la API', async () => {
    await openReportesTab((url) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/pyl')) return Promise.resolve({ data: pylData });
      if (url.includes('/finanzas/roi')) {
        return Promise.resolve({
          data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    expect(await screen.findByText('💰 Ingresos brutos')).toBeInTheDocument();
    expect(screen.getByText(fmt(350000))).toBeInTheDocument(); // ingresos brutos
    expect(screen.getByText(fmt(315000))).toBeInTheDocument(); // ingresos netos
    expect(screen.getByText(fmt(35000))).toBeInTheDocument(); // descuentos
    expect(screen.getByText(fmt(60000))).toBeInTheDocument(); // insumos
    expect(screen.getByText(fmt(20000))).toBeInTheDocument(); // devoluciones
    expect(screen.getByText(fmt(-93000))).toBeInTheDocument(); // utilidad neta
  });

  it('el resumen del período envía desde y hasta (el input hasta ya no está muerto)', async () => {
    await openReportesTab((url) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/pyl')) return Promise.resolve({ data: pylData });
      if (url.includes('/finanzas/resumen')) {
        return Promise.resolve({ data: { totalServicios: 100000 } });
      }
      if (url.includes('/finanzas/roi')) {
        return Promise.resolve({
          data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    // El tab Registros (tab activo por defecto) también consulta /finanzas/resumen
    // al montar; tomar la última llamada (la del ReportesTab, con desde+hasta).
    const resumenCalls = mockGet.mock.calls.filter(([url]) =>
      String(url).includes('/finanzas/resumen'),
    );
    expect(resumenCalls.length).toBeGreaterThan(0);
    const resumenCall = resumenCalls[resumenCalls.length - 1];
    expect(resumenCall[1].params).toMatchObject({ desde: todayStr, hasta: todayStr });
  });

  it('rol restringido es forzado a su propio usuarioId y no muestra el filtro de empleada', async () => {
    await openReportesTab((url) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: manicurista });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/pyl')) return Promise.resolve({ data: pylData });
      if (url.includes('/finanzas/roi')) {
        return Promise.resolve({
          data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    const pylCall = getPylCall()!;
    expect(pylCall[1].params).toMatchObject({ desde: todayStr, hasta: todayStr, usuarioId: '4' });
    expect(await screen.findByText('👤 Solo mis registros')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('🔍 Buscar empleada...')).toBeNull();
  });

  it('rol privilegiado ve el filtro de empleada y lo envía al P&L', async () => {
    await openReportesTab((url) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/pyl')) return Promise.resolve({ data: pylData });
      if (url.includes('/finanzas/roi')) {
        return Promise.resolve({
          data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    expect(await screen.findByPlaceholderText('🔍 Buscar empleada...')).toBeInTheDocument();
    expect(screen.queryByText('👤 Solo mis registros')).toBeNull();
  });

  it('Generar reporte envía las fechas elegidas al P&L', async () => {
    await openReportesTab((url) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/pyl')) return Promise.resolve({ data: pylData });
      if (url.includes('/finanzas/roi')) {
        return Promise.resolve({
          data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    // Ambos date inputs arrancan en hoy
    const dateInputs = await screen.findAllByDisplayValue(todayStr);
    fireEvent.change(dateInputs[0], { target: { value: '2026-05-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-05-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar reporte' }));

    await waitFor(() => {
      const calls = mockGet.mock.calls.filter(([url]) =>
        String(url).includes('/finanzas/pyl'),
      );
      expect(calls.length).toBeGreaterThan(0);
      const last = calls[calls.length - 1][1].params;
      expect(last).toMatchObject({ desde: '2026-05-01', hasta: '2026-05-31' });
    });
  });
});

describe('FinanzasPage — Exportar Excel', () => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const pylData = {
    desde: '2026-05-01',
    hasta: '2026-05-31',
    cantidadAtenciones: 3,
    ingresosBrutos: 350000,
    descuentos: 35000,
    ingresosNetos: 315000,
    totalServicios: 270000,
    totalProductos: 45000,
    propinas: 15000,
    costoBaseInsumos: 60000,
    margenBruto: 255000,
    comisiones: 48000,
    gastosFijos: 200000,
    gastosOperativos: 80000,
    gastosPorCategoria: { ARRIENDO: 200000, SERVICIOS_PUBLICOS: 80000 },
    totalGastos: 280000,
    devoluciones: 20000,
    utilidadNeta: -93000,
  };

  const baseMock = (url: string): Promise<unknown> => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('/finanzas/pyl')) return Promise.resolve({ data: pylData });
    if (url.includes('/finanzas/roi')) {
      return Promise.resolve({
        data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
      });
    }
    if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  };

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockCreateObjectURL.mockReset();
    mockRevokeObjectURL.mockReset();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  it('el botón Exportar Excel descarga un blob con responseType blob y los params del período', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/finanzas/exportar')) {
        return Promise.resolve({ data: new Blob(['xlsx-fake'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) });
      }
      return baseMock(url);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '📊 Reportes' }));
    await screen.findByText('💰 Ingresos brutos');

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    await waitFor(() => {
      const exportCall = mockGet.mock.calls.find(([url]) =>
        String(url).includes('/finanzas/exportar'),
      );
      expect(exportCall).toBeTruthy();
      expect(exportCall![1]).toMatchObject({
        params: { desde: todayStr, hasta: todayStr },
        responseType: 'blob',
      });
    });

    // Descarga real: createObjectURL + anchor download + revoke
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('rol restringido exporta con su propio usuarioId', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: manicurista });
      if (url.includes('/finanzas/exportar')) {
        return Promise.resolve({ data: new Blob(['xlsx']) });
      }
      return baseMock(url);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '📊 Reportes' }));
    await screen.findByText('👤 Solo mis registros');

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    await waitFor(() => {
      const exportCall = mockGet.mock.calls.find(([url]) =>
        String(url).includes('/finanzas/exportar'),
      );
      expect(exportCall![1].params).toMatchObject({ usuarioId: '4' });
    });
  });

  it('un error blob del servidor muestra un mensaje de fallo (no crashea)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/finanzas/exportar')) {
        const errorBlob = new Blob(
          [JSON.stringify({ error: { message: 'Rango inválido' } })],
          { type: 'application/json' },
        );
        return Promise.reject({ response: { data: errorBlob } });
      }
      return baseMock(url);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '📊 Reportes' }));
    await screen.findByText('💰 Ingresos brutos');

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(await screen.findByText(/rango inválido/i)).toBeInTheDocument();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });
});
