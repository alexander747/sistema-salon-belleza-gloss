import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
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

  it('monta el CajaBanner dentro del tab Caja (no en otros tabs)', async () => {
    defaultApiMock();

    renderPage();

    // Tab por defecto (Registros): el banner NO se monta
    expect(screen.queryByText(/caja cerrada — abrir para vender/i)).not.toBeInTheDocument();

    // Al activar el tab Caja el banner consulta el estado de caja al montar
    fireEvent.click(await screen.findByRole('button', { name: '💰 Caja' }));
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

describe('FinanzasPage — tab Cuentas (por cobrar / por pagar)', () => {
  const cuentasCobrar = [
    { id: 1, tipo: 'CLIENTE', nombre: 'Ana Gómez', deudaTotal: 120000, cantidadRegistros: 2, antiguedadDias: 45, antiguedadBucket: '31-60' },
    { id: 2, tipo: 'CLIENTE', nombre: 'Lina Pérez', deudaTotal: 40000, cantidadRegistros: 1, antiguedadDias: 5, antiguedadBucket: '0-30' },
    { id: 99, tipo: 'PRESTAMO', nombre: 'Luis Ramírez', deudaTotal: 85000, cantidadRegistros: null, antiguedadDias: 3, antiguedadBucket: '0-30' },
  ];

  const cuentasPagar = [
    { empleadaId: 3, nombre: 'María Torres', sueldoFijo: 800000, porcentajeComisionServicio: 30, pendienteActual: 298000, liquidadoAcumulado: 550000, alDia: false },
    { empleadaId: 4, nombre: 'Sofía Ruiz', sueldoFijo: 0, porcentajeComisionServicio: 40, pendienteActual: 0, liquidadoAcumulado: 200000, alDia: true },
  ];

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/\u00a0/g, ' ');

  const cuentasResponse = (data: unknown[], total: number) => ({
    data: {
      ok: true,
      data: {
        data,
        meta: { page: 1, limit: 12, total, totalPages: Math.max(1, Math.ceil(total / 12)) },
      },
    },
  });

  /** Mock base del tab Cuentas: responde los endpoints de cuentas con datos por defecto. */
  function cuentasApiMock(url: string): Promise<unknown> {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('/finanzas/cuentas/cobrar')) {
      return Promise.resolve(cuentasResponse(cuentasCobrar, cuentasCobrar.length));
    }
    if (url.includes('/finanzas/cuentas/pagar')) {
      return Promise.resolve(cuentasResponse(cuentasPagar, cuentasPagar.length));
    }
    if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
    if (url.includes('/clientes')) return Promise.resolve({ data: [] });
    if (url.includes('/registros')) {
      return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
    }
    if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  }

  async function openCuentasTab(
    mockImpl: (url: string) => Promise<unknown> = cuentasApiMock,
  ) {
    mockGet.mockImplementation(mockImpl);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '💳 Cuentas' }));
    // Esperar a que el tab dispare la consulta de cuentas por cobrar
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/finanzas/cuentas/cobrar'),
        expect.anything(),
      );
    });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('agrega el tab "💳 Cuentas" a la navegación para roles privilegiados', async () => {
    mockGet.mockImplementation(cuentasApiMock);
    renderPage();
    expect(await screen.findByRole('button', { name: '💳 Cuentas' })).toBeInTheDocument();
  });

  it('renderiza la sub-vista Cobrar con cliente, deuda, registros y antigüedad de la API', async () => {
    await openCuentasTab();

    expect(await screen.findByRole('button', { name: /por cobrar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /por pagar/i })).toBeInTheDocument();

    const ana = await screen.findByText('Ana Gómez');
    const anaRow = ana.closest('tr')!;
    expect(within(anaRow).getByText(fmt(120000))).toBeInTheDocument(); // deudaTotal
    expect(within(anaRow).getByText('2')).toBeInTheDocument(); // cantidadRegistros
    expect(within(anaRow).getByText('31-60 días')).toBeInTheDocument(); // bucket antigüedad

    const lina = screen.getByText('Lina Pérez');
    const linaRow = lina.closest('tr')!;
    expect(within(linaRow).getByText(fmt(40000))).toBeInTheDocument();
    expect(within(linaRow).getByText('0-30 días')).toBeInTheDocument();
  });

  it('cambia a la sub-vista Pagar con empleada, pendiente, liquidado, sueldo fijo y comisión', async () => {
    await openCuentasTab();

    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));

    const maria = await screen.findByText('María Torres');
    const mariaRow = maria.closest('tr')!;
    expect(within(mariaRow).getByText(fmt(298000))).toBeInTheDocument(); // pendienteActual
    expect(within(mariaRow).getByText(fmt(550000))).toBeInTheDocument(); // liquidadoAcumulado
    expect(within(mariaRow).getByText(fmt(800000))).toBeInTheDocument(); // sueldoFijo
    expect(within(mariaRow).getByText('30%')).toBeInTheDocument(); // porcentajeComisionServicio
  });

  it('muestra badge "Al día" cuando pendienteActual es 0 (ya liquidada, solo historial)', async () => {
    await openCuentasTab();

    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));

    const sofia = await screen.findByText('Sofía Ruiz');
    const sofiaRow = sofia.closest('tr')!;
    expect(within(sofiaRow).getByText(/al día/i)).toBeInTheDocument();
    expect(within(sofiaRow).getByText(fmt(200000))).toBeInTheDocument(); // liquidadoAcumulado
  });

  it('muestra préstamos activos en Por cobrar con badge Préstamo y el saldo como deuda', async () => {
    await openCuentasTab();

    const luis = await screen.findByText('Luis Ramírez');
    const luisRow = luis.closest('tr')!;
    expect(within(luisRow).getByText('Préstamo')).toBeInTheDocument();
    expect(within(luisRow).getByText(fmt(85000))).toBeInTheDocument(); // deudaTotal = saldoPendiente
    expect(within(luisRow).getByText('—')).toBeInTheDocument(); // sin cantidadRegistros
    expect(within(luisRow).getByText('0-30 días')).toBeInTheDocument();

    const ana = screen.getByText('Ana Gómez');
    const anaRow = ana.closest('tr')!;
    expect(within(anaRow).getByText('Cliente')).toBeInTheDocument();
  });

  it('separa Por pagar en secciones Pendientes (deuda) y Al día (liquidadas)', async () => {
    await openCuentasTab();

    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));

    const pendientes = await screen.findByTestId('seccion-pendientes');
    expect(within(pendientes).getByText('María Torres')).toBeInTheDocument();
    expect(within(pendientes).getByText(fmt(298000))).toBeInTheDocument(); // pendienteActual
    expect(within(pendientes).queryByText('Sofía Ruiz')).toBeNull();

    const alDia = screen.getByTestId('seccion-al-dia');
    expect(within(alDia).getByText('Sofía Ruiz')).toBeInTheDocument();
    expect(within(alDia).getByText(fmt(200000))).toBeInTheDocument(); // liquidadoAcumulado
    expect(within(alDia).queryByText('María Torres')).toBeNull();

    expect(screen.getByRole('heading', { name: /pendientes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /al día/i })).toBeInTheDocument();
  });

  it('muestra nota "Sin pagos pendientes" cuando no hay deuda pero sí historial al día', async () => {
    await openCuentasTab((url) => {
      if (url.includes('/finanzas/cuentas/pagar')) {
        return Promise.resolve(
          cuentasResponse(
            [{ empleadaId: 4, nombre: 'Sofía Ruiz', sueldoFijo: 0, porcentajeComisionServicio: 40, pendienteActual: 0, liquidadoAcumulado: 200000, alDia: true }],
            1,
          ),
        );
      }
      return cuentasApiMock(url);
    });

    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));

    const pendientes = await screen.findByTestId('seccion-pendientes');
    expect(within(pendientes).getByText(/sin pagos pendientes/i)).toBeInTheDocument();
    const alDia = screen.getByTestId('seccion-al-dia');
    expect(within(alDia).getByText('Sofía Ruiz')).toBeInTheDocument();
  });

  it('NO muestra botones de cobro ni "registrar pago" en la sub-vista Cobrar (v1 read-only)', async () => {
    await openCuentasTab();
    await screen.findByText('Ana Gómez');

    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /registrar pago/i })).toBeNull();
  });

  it('muestra estado vacío "No hay deudas pendientes" cuando Cobrar viene vacío', async () => {
    await openCuentasTab((url) => {
      if (url.includes('/finanzas/cuentas/cobrar')) return Promise.resolve(cuentasResponse([], 0));
      return cuentasApiMock(url);
    });

    expect(await screen.findByText(/no hay deudas pendientes/i)).toBeInTheDocument();
  });

  it('muestra estado vacío "No hay pagos pendientes" cuando Pagar viene vacío', async () => {
    await openCuentasTab((url) => {
      if (url.includes('/finanzas/cuentas/pagar')) return Promise.resolve(cuentasResponse([], 0));
      return cuentasApiMock(url);
    });

    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));
    expect(await screen.findByText(/no hay pagos pendientes/i)).toBeInTheDocument();
  });

  it('oculta el tab Cuentas para roles restringidos (MANICURISTA)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: manicurista });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      return cuentasApiMock(url);
    });

    renderPage();
    await screen.findByRole('button', { name: '📋 Registros' });

    expect(screen.queryByRole('button', { name: '💳 Cuentas' })).toBeNull();
  });

  it('navega a la página 2 de Cobrar con el botón Siguiente', async () => {
    await openCuentasTab((url) => {
      if (url.includes('/finanzas/cuentas/cobrar')) {
        return Promise.resolve(cuentasResponse(cuentasCobrar, 25));
      }
      return cuentasApiMock(url);
    });

    await screen.findByText('Ana Gómez');
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => {
      const cobrarCalls = mockGet.mock.calls.filter(([u]) =>
        String(u).includes('/finanzas/cuentas/cobrar'),
      );
      expect(cobrarCalls[cobrarCalls.length - 1][1].params).toMatchObject({ page: 2, limit: 12 });
    });
  });

  it('navega a la página 2 de Pagar con el botón Siguiente', async () => {
    await openCuentasTab((url) => {
      if (url.includes('/finanzas/cuentas/pagar')) {
        return Promise.resolve(cuentasResponse(cuentasPagar, 25));
      }
      return cuentasApiMock(url);
    });

    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));
    await screen.findByText('María Torres');
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => {
      const pagarCalls = mockGet.mock.calls.filter(([u]) =>
        String(u).includes('/finanzas/cuentas/pagar'),
      );
      expect(pagarCalls[pagarCalls.length - 1][1].params).toMatchObject({ page: 2, limit: 12 });
    });
  });

  it('muestra error y botón Reintentar cuando ambas consultas fallan', async () => {
    await openCuentasTab((url) => {
      if (url.includes('/finanzas/cuentas/cobrar')) return Promise.reject(new Error('boom'));
      if (url.includes('/finanzas/cuentas/pagar')) return Promise.reject(new Error('boom'));
      return cuentasApiMock(url);
    });

    expect(await screen.findByText(/error al cargar las cuentas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});

describe('FinanzasPage — tab Nómina (período por frecuencia de pago)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  const nominaApiMock = (url: string): Promise<unknown> => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/caja/actual')) return Promise.reject(error404);
    if (url.includes('/finanzas/nomina/historial')) return Promise.resolve({ data: [] });
    if (url.includes('/finanzas/nomina')) {
      return Promise.resolve({
        data: [
          {
            empleadaId: 1,
            nombre: 'Ana',
            totalComisionesPendientes: 0,
            totalPropinas: 0,
            bonoHorario: 25000,
            sueldoFijo: 100000,
            porcentajeComisionServicio: 0,
            totalAPagar: 125000,
            cantidadRegistros: 0,
            periodoInicio: '2026-08-01T05:00:00.000Z',
            periodoFin: '2026-08-16T05:00:00.000Z',
            frecuenciaPago: 'QUINCENAL',
          },
        ],
      });
    }
    if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
    if (url.includes('/clientes')) return Promise.resolve({ data: [] });
    if (url.includes('/registros')) {
      return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
    }
    return Promise.resolve({ data: {} });
  };

  it('muestra el período de la quincena en la tarjeta de la empleada', async () => {
    mockGet.mockImplementation(nominaApiMock);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));

    expect(
      await screen.findByText('Período QUINCENAL · 01/08/2026 → 15/08/2026'),
    ).toBeInTheDocument();
  });
});

describe('FinanzasPage — modal auditoría (período editable / pago fuera de ciclo)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  const pendienteSemanal: Record<string, unknown> = {
    empleadaId: 1,
    nombre: 'Ana',
    totalComisionesPendientes: 30000,
    totalPropinas: 5000,
    bonoHorario: 12500,
    sueldoFijo: 50000,
    porcentajeComisionServicio: 0,
    totalAPagar: 97500,
    cantidadRegistros: 1,
    periodoInicio: '2026-08-10T05:00:00.000Z', // lunes (inclusivo)
    periodoFin: '2026-08-17T05:00:00.000Z', // domingo + 1 (exclusivo)
    frecuenciaPago: 'SEMANAL',
  };

  const registroDentroSemana = {
    id: 1,
    salonId: 1,
    clienteId: 1,
    usuarioId: 1,
    totalServicios: 1,
    totalProductos: 0,
    montoTotal: 60000,
    montoPendiente: 0,
    propina: 5000,
    comisionCalculada: 30000,
    esRetoque: false,
    descripcionServicio: null,
    estaPagadaEmpleada: false,
    creadoEn: '2026-08-11T10:00:00', // martes 11 (dentro de la semana)
    actualizadoEn: '2026-08-11T10:00:00',
    pagos: [],
    divisiones: [],
    serviciosItems: [
      { id: 11, nombreServicio: 'Manicure Básico', precioServicio: 60000, costoBaseInsumos: 5000 },
    ],
  };

  const registroFueraSemana = {
    ...registroDentroSemana,
    id: 2,
    clienteId: 2,
    montoTotal: 40000,
    propina: 0,
    comisionCalculada: 20000,
    creadoEn: '2026-08-20T10:00:00', // jueves 20 (fuera de la semana)
    actualizadoEn: '2026-08-20T10:00:00',
    serviciosItems: [
      { id: 12, nombreServicio: 'Manicure Avanzado', precioServicio: 40000, costoBaseInsumos: 8000 },
    ],
  };

  function auditApiMock(options: { historial?: unknown[] } = {}) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/nomina/historial')) {
        return Promise.resolve({ data: options.historial ?? [] });
      }
      if (url.includes('/finanzas/nomina')) {
        return Promise.resolve({ data: [pendienteSemanal] });
      }
      if (url.includes('/prestamos')) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        return Promise.resolve({
          data: { data: [registroDentroSemana, registroFueraSemana], meta: { page: 1, limit: 50, total: 2, totalPages: 1 } },
        });
      }
      return Promise.resolve({ data: {} });
    });
  }

  async function openAuditModal() {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Auditar y Liquidar' }));
    await screen.findByText('Auditoría pre-liquidación');
  }

  it('precarga Desde/Hasta con el período de la fila pendiente (lunes→domingo inclusive)', async () => {
    auditApiMock();
    await openAuditModal();

    expect(screen.getByLabelText('Período desde')).toHaveValue('2026-08-10');
    expect(screen.getByLabelText('Período hasta')).toHaveValue('2026-08-16');
  });

  it('muestra solo los registros del período por defecto y re-filtra al editar Hasta', async () => {
    auditApiMock();
    await openAuditModal();

    // Solo el registro del 11/08 (dentro de la semana) aparece en el detalle
    expect(await screen.findByText('Manicure Básico')).toBeInTheDocument();
    expect(screen.queryByText('Manicure Avanzado')).toBeNull();
    expect(screen.getByText('1 registros')).toBeInTheDocument();

    // Extender Hasta → el registro del 20/08 entra al detalle
    fireEvent.change(screen.getByLabelText('Período hasta'), {
      target: { value: '2026-08-20' },
    });

    expect(await screen.findByText('Manicure Avanzado')).toBeInTheDocument();
    expect(screen.getByText('2 registros')).toBeInTheDocument();
  });

  it('confirmar la liquidación envía el período EDITADO en bordes Colombia (T05:00:00.000Z)', async () => {
    auditApiMock();
    mockPost.mockResolvedValue({ data: {} });
    await openAuditModal();

    fireEvent.change(screen.getByLabelText('Período desde'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('Período hasta'), {
      target: { value: '2026-08-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: '✅ Confirmar liquidación' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/finanzas/nomina/liquidar',
        expect.objectContaining({
          usuarioId: 1,
          periodoInicio: '2026-08-01T05:00:00.000Z',
          periodoFin: '2026-08-21T05:00:00.000Z', // hasta inclusive + 1 día (colombiaDayEndUTC)
        }),
      );
    });
  });

  it('avisa si el período editado se solapa con una liquidación previa del historial', async () => {
    auditApiMock({
      historial: [
        {
          id: 5,
          usuarioId: 1,
          fechaDesde: '2026-08-01T05:00:00.000Z',
          fechaHasta: '2026-08-10T05:00:00.000Z', // inclusive = 09/08
          totalPagado: 50000,
          creadoEn: '2026-08-10T12:00:00.000Z',
        },
      ],
    });
    await openAuditModal();

    // Período por defecto (10→16) NO solapa la liquidación 01→09
    expect(screen.queryByText(/se solapa con la liquidación/i)).toBeNull();

    // Editar Desde al 05/08 → el rango 05→16 solapa la liquidación 01→09
    fireEvent.change(screen.getByLabelText('Período desde'), {
      target: { value: '2026-08-05' },
    });

    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText(/#5/i)).toBeInTheDocument();
    expect(alerta).toHaveTextContent(/comp fijo podría pagarse nuevamente/i);
  });
});
