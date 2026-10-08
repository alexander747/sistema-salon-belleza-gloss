import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';
import { setMobileMedia } from '../../test/setMobileMedia';

const { mockGet, mockPost, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost, delete: mockDelete },
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

const recepcionista: IUser = {
  ...duena,
  id: 5,
  nombre: 'Recepcionista Test',
  email: 'recepcionista@test.com',
  rol: Rol.RECEPCIONISTA,
};

const contador: IUser = {
  ...duena,
  id: 6,
  nombre: 'Contador Test',
  email: 'contador@test.com',
  rol: Rol.CONTADOR,
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
    mockDelete.mockReset();
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
  const todayStr = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10); // fecha Colombia (UTC-5)
  const firstOfMonthStr = todayStr.slice(0, 8) + '01';

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
    contribucion: 42000,
    gastosNegocio: 280000,
    devolucionesNegocio: 20000,
    utilidadNeta: -93000,
    cobrado: 150000,
    fiadoPeriodo: 100000,
    deudasPorCobrar: 210000,
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
    mockDelete.mockReset();
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
    expect(pylCall[1].params).toEqual({ desde: firstOfMonthStr, hasta: todayStr });
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

    expect(await screen.findByText('💰 Ventas brutas (antes de descuentos)')).toBeInTheDocument();
    expect(screen.getByText(fmt(350000))).toBeInTheDocument(); // ingresos brutos
    expect(screen.getByText(fmt(315000))).toBeInTheDocument(); // ingresos netos
    expect(screen.getByText(fmt(35000))).toBeInTheDocument(); // descuentos
    expect(screen.getByText(fmt(60000))).toBeInTheDocument(); // insumos
    expect(screen.getByText(fmt(20000))).toBeInTheDocument(); // devoluciones
    expect(screen.getByText(fmt(-93000))).toBeInTheDocument(); // utilidad neta
    // Nuevas tarjetas informativas: atenciones y ticket promedio (neto ÷ atenciones = 315000 / 3)
    expect(screen.getByText('✂️ Atenciones')).toBeInTheDocument();
    expect(screen.getByText('🎫 Ticket promedio')).toBeInTheDocument();
    expect(screen.getByText(fmt(105000))).toBeInTheDocument();
    // El salón ya no acepta propinas: la tarjeta se eliminó junto con el uso de pyl.propinas
    expect(screen.queryByText('🎁 Propinas')).toBeNull();
    // Sin filtro de empleada se conserva el layout salon-wide: Gastos/Devoluciones
    // totales y utilidad neta, SIN el desglose "Del salón".
    expect(screen.getByText(fmt(280000))).toBeInTheDocument(); // gastos salon-wide (200000 + 80000)
    expect(screen.getByText('📊 Ganancia neta (utilidad)')).toBeInTheDocument();
    expect(screen.queryByText('🏠 Del salón (no se descuenta a la empleada)')).toBeNull();
    expect(screen.queryByText('👤 Aporte de la empleada (lo que genera)')).toBeNull();
  });

  it('muestra ⓘ de ayuda en las tarjetas del P&L y el popup alterna con clic', async () => {
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

    // Varias tarjetas exponen su ⓘ accesible (nombre = "Qué significa <label>")
    const cobradoInfo = await screen.findByRole('button', { name: 'Qué significa Cobrado en el período' });
    expect(screen.getByRole('button', { name: 'Qué significa Ventas brutas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qué significa Ganancia neta' })).toBeInTheDocument();
    const ticketInfo = screen.getByRole('button', { name: 'Qué significa Ticket promedio' });
    expect(cobradoInfo).toHaveAttribute('aria-expanded', 'false');

    // Un clic abre el popup con la explicación
    fireEvent.click(ticketInfo);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent(/Venta neta promedio por atención/i);
    expect(ticketInfo).toHaveAttribute('aria-expanded', 'true');

    // Un segundo clic lo cierra
    fireEvent.click(ticketInfo);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(ticketInfo).toHaveAttribute('aria-expanded', 'false');

    // Clic afuera también cierra
    fireEvent.click(cobradoInfo);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Plata que efectivamente ENTRÓ/i);
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('con filtro de empleada muestra su contribución y los gastos/devoluciones del salón en un grupo aparte', async () => {
    const pylFiltrado = {
      ...pylData,
      cantidadAtenciones: 2,
      contribucion: 80000,
      gastosNegocio: 280000,
      devolucionesNegocio: 20000,
      utilidadNeta: 80000, // con filtro de empleada la API devuelve contribución
    };

    mockGet.mockImplementation(
      (url: string, config?: { params?: Record<string, string> }) => {
        if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
        if (url.includes('/caja/actual')) return Promise.reject(error404);
        if (url.includes('/finanzas/pyl')) {
          const filtrado = config?.params?.usuarioId != null;
          return Promise.resolve({ data: filtrado ? pylFiltrado : pylData });
        }
        if (url.includes('/finanzas/roi')) {
          return Promise.resolve({
            data: { ingresos: 0, gastosFijos: 0, gastosOperativos: 0, nomina: 0, gananciaNeta: 0 },
          });
        }
        if (url.includes('/empleadas')) {
          return Promise.resolve({ data: [{ id: 4, nombre: 'Manicurista Test' }] });
        }
        return Promise.resolve({ data: {} });
      },
    );

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '📊 Reportes' }));
    await screen.findByText('💰 Ventas brutas (antes de descuentos)');

    // Seleccionar la empleada en el filtro (dispara el refetch con usuarioId)
    fireEvent.focus(screen.getByPlaceholderText('🔍 Buscar empleada...'));
    fireEvent.click(await screen.findByRole('option', { name: /Manicurista Test/ }));

    await waitFor(() => {
      const calls = mockGet.mock.calls.filter(([url]) =>
        String(url).includes('/finanzas/pyl'),
      );
      expect(calls[calls.length - 1][1].params).toMatchObject({ usuarioId: '4' });
    });

    // Contribución de la empleada (cobrado − insumos − comisiones)
    expect(
      await screen.findByText('👤 Aporte de la empleada (lo que genera)'),
    ).toBeInTheDocument();
    expect(screen.getByText(fmt(80000))).toBeInTheDocument();

    // Gastos/devoluciones del salón en grupo separado y etiquetado
    expect(
      screen.getByText('🏠 Del salón (no se descuenta a la empleada)'),
    ).toBeInTheDocument();
    expect(screen.getByText('💸 Gastos del salón')).toBeInTheDocument();
    expect(screen.getByText('↩️ Devoluciones del salón')).toBeInTheDocument();
    expect(screen.getByText(fmt(280000))).toBeInTheDocument(); // gastosNegocio
    expect(screen.getByText(fmt(20000))).toBeInTheDocument(); // devolucionesNegocio

    // En modo filtrado no se muestra la utilidad neta salon-wide
    expect(screen.queryByText('📊 Ganancia neta (utilidad)')).toBeNull();
  });

  it('P&L cash-basis: muestra Cobrado, Fiado del período y Deudas por cobrar (PR2)', async () => {
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

    expect(await screen.findByText('💰 Cobrado en el período (lo que entró)')).toBeInTheDocument();
    expect(screen.getByText(fmt(150000))).toBeInTheDocument(); // cobrado
    expect(screen.getByText('🧾 Fiado nuevo (aún sin cobrar)')).toBeInTheDocument();
    expect(screen.getByText(fmt(100000))).toBeInTheDocument(); // fiadoPeriodo
    // La deuda por cobrar es un snapshot acumulado a la fecha Hasta: se movió
    // fuera de "Dinero de caja" a su propia sección de cuentas por cobrar.
    expect(screen.getByText('📌 Cuentas por cobrar')).toBeInTheDocument();
    expect(
      screen.getByText('📌 Te deben (total acumulado al 2026-05-31)'),
    ).toBeInTheDocument();
    expect(screen.getByText(fmt(210000))).toBeInTheDocument(); // deudasPorCobrar
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
    expect(resumenCall[1].params).toMatchObject({ desde: firstOfMonthStr, hasta: todayStr });
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

  it('cambiar las fechas refetchea el P&L automáticamente (auto-refresh, sin botón)', async () => {
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

    // Los inputs de rango del P&L se toman por su label (robusto a la fecha
    // de hoy: antes se asumía que "Hasta" también mostraba el 1° del mes).
    const desdeInput = (await screen.findByLabelText(/^Desde:$/i)) as HTMLInputElement;
    const hastaInput = (await screen.findByLabelText(/^Hasta:$/i)) as HTMLInputElement;
    fireEvent.change(desdeInput, { target: { value: '2026-05-01' } });
    fireEvent.change(hastaInput, { target: { value: '2026-05-31' } });

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

describe('FinanzasPage — resumen cash del día (Cobrado / Fiado del período, PR4)', () => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/\u00a0/g, ' ');

  it('RegistrosTab: muestra Entró a caja y Fiado del período junto a Ventas del día', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/registros')) {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
      }
      if (url.includes('/finanzas/resumen')) {
        return Promise.resolve({
          data: { totalIngresos: 100000, totalCobrado: 40000, totalFiadoDia: 60000 },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    renderPage();

    // El tab Registros es el activo por defecto → las cards aparecen sin navegar
    const ventasCard = await screen.findByTestId('card-ventas-dia');
    expect(ventasCard).toHaveTextContent('Ventas del día');
    expect(ventasCard).toHaveTextContent(fmt(100000)); // totalIngresos (devengado)
    const cajaCard = screen.getByTestId('card-entro-caja');
    expect(cajaCard).toHaveTextContent('Entró a caja');
    expect(cajaCard).toHaveTextContent(fmt(40000)); // totalCobrado
    expect(screen.getByText('🧾 Fiado del período')).toBeInTheDocument();
    // La tira de reconciliación refleja los mismos valores del resumen
    await screen.findByTestId('tira-reconciliacion');
    expect(within(screen.getByTestId('tira-row-ventas')).getByText(fmt(100000))).toBeInTheDocument();
    expect(within(screen.getByTestId('tira-row-cobrado')).getByText(fmt(40000))).toBeInTheDocument();
    expect(within(screen.getByTestId('tira-row-fiado')).getByText(fmt(60000))).toBeInTheDocument();
  });
});

describe('FinanzasPage — Registros: tarjetas movidas a Reportes (T4)', () => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/\u00a0/g, ' ');

  function resumenApiMock(user: IUser, resumen: Record<string, unknown>) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: user });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: { ok: true, data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } },
        });
      }
      if (url.includes('/registros')) {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: resumen });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  it('DUEÑA: el resumen del período ya no muestra Servicios/Productos/Total insumos', async () => {
    resumenApiMock(duena, {
      totalIngresos: 555000,
      totalServicios: 270000,
      totalProductos: 45000,
      totalCostoBaseInsumos: 84000,
    });

    renderPage();

    expect(await screen.findByTestId('card-ventas-dia')).toBeInTheDocument();
    // T4: las tres tarjetas se fueron a Reportes.
    expect(screen.queryByText('💇 Servicios')).not.toBeInTheDocument();
    expect(screen.queryByText('🧴 Productos')).not.toBeInTheDocument();
    expect(screen.queryByText('🧴 Total insumos')).not.toBeInTheDocument();
    // El resumen se consultó: la ausencia se decide con datos reales.
    expect(screen.queryByText(fmt(84000))).not.toBeInTheDocument();
  });

  it('RECEPCIONISTA no ve las tarjetas retiradas ni el tab Reportes', async () => {
    resumenApiMock(
      { ...duena, id: 5, rol: Rol.RECEPCIONISTA },
      { totalIngresos: 555000, totalCostoBaseInsumos: 84000 },
    );

    renderPage();

    // El resumen sí se consultó: la tarjeta ausente se decide con datos reales.
    await waitFor(() =>
      expect(
        mockGet.mock.calls.some(([url]) => String(url).includes('/finanzas/resumen')),
      ).toBe(true),
    );
    expect(screen.queryByText('🧴 Total insumos')).not.toBeInTheDocument();
    expect(screen.queryByText('💇 Servicios')).not.toBeInTheDocument();
    expect(screen.queryByText('🧴 Productos')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '📊 Reportes' })).not.toBeInTheDocument();
  });
});

describe('FinanzasPage — Exportar Excel', () => {
  const todayStr = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10); // fecha Colombia (UTC-5)
  const firstOfMonthStr = todayStr.slice(0, 8) + '01';

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
    await screen.findByText('💰 Ventas brutas (antes de descuentos)');

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    await waitFor(() => {
      const exportCall = mockGet.mock.calls.find(([url]) =>
        String(url).includes('/finanzas/exportar'),
      );
      expect(exportCall).toBeTruthy();
      expect(exportCall![1]).toMatchObject({
        params: { desde: firstOfMonthStr, hasta: todayStr },
        responseType: 'blob',
      });
    });

    // Descarga real: createObjectURL + anchor download + revoke
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('rol no privilegiado no ve el tab Reportes ni el botón Exportar Excel', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: manicurista });
      return baseMock(url);
    });

    renderPage();

    expect(await screen.findByRole('button', { name: '📋 Registros' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '📊 Reportes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exportar excel/i })).not.toBeInTheDocument();
    expect(
      mockGet.mock.calls.some(([url]) => String(url).includes('/finanzas/exportar')),
    ).toBe(false);
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
    await screen.findByText('💰 Ventas brutas (antes de descuentos)');

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(await screen.findByText(/rango inválido/i)).toBeInTheDocument();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });
});

describe('FinanzasPage — tab Cuentas (por cobrar / por pagar)', () => {
  const cuentasCobrar = [
    {
      id: 1, tipo: 'CLIENTE', nombre: 'Ana Gómez', deudaTotal: 120000, cantidadRegistros: 2, antiguedadDias: 45, antiguedadBucket: '31-60',
      registros: [
        { registroId: 101, fechaHora: '2026-04-01T10:00:00.000Z', montoPendiente: 70000 },
        { registroId: 102, fechaHora: '2026-05-10T10:00:00.000Z', montoPendiente: 50000 },
      ],
    },
    {
      id: 2, tipo: 'CLIENTE', nombre: 'Lina Pérez', deudaTotal: 40000, cantidadRegistros: 1, antiguedadDias: 5, antiguedadBucket: '0-30',
      registros: [{ registroId: 103, fechaHora: '2026-08-01T10:00:00.000Z', montoPendiente: 40000 }],
    },
    { id: 99, tipo: 'PRESTAMO', nombre: 'Luis Ramírez', deudaTotal: 85000, cantidadRegistros: null, antiguedadDias: 3, antiguedadBucket: '0-30', registros: null },
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
    mockDelete.mockReset();
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

  it('muestra el botón "Cobrar/Abonar" SOLO en filas CLIENTE (PRESTAMO read-only)', async () => {
    await openCuentasTab();
    await screen.findByText('Ana Gómez');

    const anaRow = screen.getByText('Ana Gómez').closest('tr')!;
    expect(within(anaRow).getByRole('button', { name: /cobrar\/abonar/i })).toBeInTheDocument();

    const linaRow = screen.getByText('Lina Pérez').closest('tr')!;
    expect(within(linaRow).getByRole('button', { name: /cobrar\/abonar/i })).toBeInTheDocument();

    const luisRow = screen.getByText('Luis Ramírez').closest('tr')!;
    expect(within(luisRow).queryByRole('button', { name: /cobrar\/abonar/i })).toBeNull();
  });

  it('abre el modal Cobrar/Abonar con cliente, deuda total y desglose por registro (default = el más antiguo)', async () => {
    await openCuentasTab();

    fireEvent.click(
      within(screen.getByText('Ana Gómez').closest('tr')!).getByRole('button', { name: /cobrar\/abonar/i }),
    );

    const modal = await screen.findByTestId('modal-abonar');
    expect(within(modal).getByText(/Ana Gómez/)).toBeInTheDocument();
    expect(within(modal).getByText(/deuda total/i)).toBeInTheDocument();
    expect(within(modal).getByText(fmt(120000))).toBeInTheDocument();

    // Desglose: ambos registros pendientes visibles con su fecha y monto
    const select = within(modal).getByLabelText('Registro a abonar');
    expect(select).toHaveValue('101'); // default = registro más antiguo (101)
    expect(within(modal).getByRole('option', { name: /01\/04\/2026/ })).toBeInTheDocument();
    expect(within(modal).getByRole('option', { name: /10\/05\/2026/ })).toBeInTheDocument();
    expect(within(modal).getByRole('option', { name: /70\.000/ })).toBeInTheDocument();
    expect(within(modal).getByRole('option', { name: /50\.000/ })).toBeInTheDocument();

    // Monto default = pendiente del registro seleccionado (el más antiguo)
    expect(within(modal).getByLabelText('Monto a abonar')).toHaveValue('70.000');
    expect(within(modal).getByLabelText('Método de pago')).toHaveValue('EFECTIVO');
    expect(within(modal).getByRole('button', { name: 'Cobrar' })).toBeInTheDocument();
  });

  it('abonar reduce la deuda: POST /registros/:id/pagos, cierra el modal, muestra éxito y refresca la lista', async () => {
    let anaDeuda = 120000;
    let anaRegistros = [
      { registroId: 101, fechaHora: '2026-04-01T10:00:00.000Z', montoPendiente: 70000 },
      { registroId: 102, fechaHora: '2026-05-10T10:00:00.000Z', montoPendiente: 50000 },
    ];
    const abonoApiMock = (url: string) => {
      if (url.includes('/finanzas/cuentas/cobrar')) {
        return Promise.resolve(
          cuentasResponse(
            [
              {
                id: 1, tipo: 'CLIENTE', nombre: 'Ana Gómez', deudaTotal: anaDeuda, cantidadRegistros: anaRegistros.length, antiguedadDias: 45, antiguedadBucket: '31-60',
                registros: anaRegistros,
              },
              cuentasCobrar[1],
              cuentasCobrar[2],
            ],
            3,
          ),
        );
      }
      return cuentasApiMock(url);
    };
    mockPost.mockImplementation((url) => {
      if (String(url).includes('/pagos')) {
        // Abono de 70000 al registro 101: el saldo pasa a 50000 y el registro 101 sale del desglose
        anaDeuda = 50000;
        anaRegistros = [{ registroId: 102, fechaHora: '2026-05-10T10:00:00.000Z', montoPendiente: 50000 }];
        return Promise.resolve({ data: { ok: true, data: { id: 101, montoPendiente: 0, pagos: [] } } });
      }
      return Promise.resolve({ data: {} });
    });

    await openCuentasTab(abonoApiMock);

    fireEvent.click(
      within(screen.getByText('Ana Gómez').closest('tr')!).getByRole('button', { name: /cobrar\/abonar/i }),
    );
    await screen.findByTestId('modal-abonar');

    // Default: registro 101 (más antiguo), monto 70000, EFECTIVO → Cobrar
    fireEvent.click(within(screen.getByTestId('modal-abonar')).getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/registros/101/pagos', {
        monto: 70000,
        metodoPago: 'EFECTIVO',
      });
    });

    // Éxito visible + modal cerrado + lista refrescada con la deuda reducida
    expect(await screen.findByText(/abono registrado/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('modal-abonar')).toBeNull());
    expect(await screen.findByText(fmt(50000))).toBeInTheDocument();
  });

  it('abonar otro registro: cambiar el select actualiza el monto default y el POST apunta al registro elegido', async () => {
    await openCuentasTab();

    fireEvent.click(
      within(screen.getByText('Ana Gómez').closest('tr')!).getByRole('button', { name: /cobrar\/abonar/i }),
    );
    const modal = await screen.findByTestId('modal-abonar');

    // Cambiar al segundo registro (102, pendiente 50000)
    fireEvent.change(within(modal).getByLabelText('Registro a abonar'), { target: { value: '102' } });
    expect(within(modal).getByLabelText('Monto a abonar')).toHaveValue('50.000');

    fireEvent.click(within(modal).getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/registros/102/pagos', {
        monto: 50000,
        metodoPago: 'EFECTIVO',
      });
    });
  });

  it('monto > pendiente muestra el error 409 del backend en el modal y NO refresca la lista', async () => {
    await openCuentasTab();
    mockPost.mockRejectedValue({
      response: {
        status: 409,
        data: { ok: false, error: { code: 'MONTO_EXCEDE_PENDIENTE', message: 'El abono supera la deuda pendiente del registro' } },
      },
    });

    fireEvent.click(
      within(screen.getByText('Ana Gómez').closest('tr')!).getByRole('button', { name: /cobrar\/abonar/i }),
    );
    await screen.findByTestId('modal-abonar');

    fireEvent.change(screen.getByLabelText('Monto a abonar'), { target: { value: '99999' } });
    const cobrarCalls = () => mockGet.mock.calls.filter(([u]) => String(u).includes('/finanzas/cuentas/cobrar'));
    const llamadasAntes = cobrarCalls().length;

    fireEvent.click(within(screen.getByTestId('modal-abonar')).getByRole('button', { name: 'Cobrar' }));

    expect(await screen.findByText(/el abono supera la deuda pendiente del registro/i)).toBeInTheDocument();
    // El modal sigue abierto y la lista NO se refrescó
    expect(screen.getByTestId('modal-abonar')).toBeInTheDocument();
    expect(screen.queryByText(/abono registrado/i)).toBeNull();
    await new Promise((r) => setTimeout(r, 100));
    expect(cobrarCalls().length).toBe(llamadasAntes);
  });

  it('sin caja abierta muestra el error 422 CAJA_CERRADA del backend en el modal', async () => {
    await openCuentasTab();
    mockPost.mockRejectedValue({
      response: {
        status: 422,
        data: { ok: false, error: { code: 'CAJA_CERRADA', message: 'No hay caja abierta para el salón. Abrí la caja antes de vender.' } },
      },
    });

    fireEvent.click(
      within(screen.getByText('Ana Gómez').closest('tr')!).getByRole('button', { name: /cobrar\/abonar/i }),
    );
    await screen.findByTestId('modal-abonar');

    fireEvent.click(within(screen.getByTestId('modal-abonar')).getByRole('button', { name: 'Cobrar' }));

    expect(await screen.findByText(/no hay caja abierta para el salón/i)).toBeInTheDocument();
    expect(screen.getByTestId('modal-abonar')).toBeInTheDocument();
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

  it('Cobrar: filtra por nombre (debounced), envía el query param y resetea a página 1', async () => {
    await openCuentasTab((url) => {
      // total 25 → habilita la paginación (3 páginas)
      if (url.includes('/finanzas/cuentas/cobrar')) return Promise.resolve(cuentasResponse(cuentasCobrar, 25));
      return cuentasApiMock(url);
    });
    await screen.findByText('Ana Gómez');

    // Ir a página 2 antes de buscar
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => {
      const calls = mockGet.mock.calls.filter(([u]) => String(u).includes('/finanzas/cuentas/cobrar'));
      expect(calls[calls.length - 1][1].params).toMatchObject({ page: 2 });
    });

    fireEvent.change(screen.getByLabelText('Buscar deuda por cliente o préstamo'), {
      target: { value: 'ana' },
    });

    await waitFor(
      () => {
        const calls = mockGet.mock.calls.filter(([u]) => String(u).includes('/finanzas/cuentas/cobrar'));
        expect(calls[calls.length - 1][1].params).toMatchObject({ page: 1, nombre: 'ana' });
      },
      { timeout: 2000 },
    );
  });

  it('Pagar: filtra por nombre (debounced) y envía el query param', async () => {
    await openCuentasTab();
    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));
    await screen.findByText('María Torres');

    fireEvent.change(screen.getByLabelText('Buscar empleada por nombre'), {
      target: { value: 'sofía' },
    });

    await waitFor(
      () => {
        const calls = mockGet.mock.calls.filter(([u]) => String(u).includes('/finanzas/cuentas/pagar'));
        expect(calls[calls.length - 1][1].params).toMatchObject({ page: 1, nombre: 'sofía' });
      },
      { timeout: 2000 },
    );
  });

  it('Cobrar: limpiar el buscador envía la consulta sin el filtro nombre', async () => {
    await openCuentasTab();
    await screen.findByText('Ana Gómez');

    const input = screen.getByLabelText('Buscar deuda por cliente o préstamo');
    fireEvent.change(input, { target: { value: 'ana' } });
    await waitFor(
      () => {
        const calls = mockGet.mock.calls.filter(([u]) => String(u).includes('/finanzas/cuentas/cobrar'));
        expect(calls[calls.length - 1][1].params).toMatchObject({ nombre: 'ana' });
      },
      { timeout: 2000 },
    );

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(
      () => {
        const calls = mockGet.mock.calls.filter(([u]) => String(u).includes('/finanzas/cuentas/cobrar'));
        expect(calls[calls.length - 1][1].params).not.toHaveProperty('nombre');
      },
      { timeout: 2000 },
    );
  });
});

describe('FinanzasPage — tab Nómina (período por frecuencia de pago)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
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
            sueldoFijoMensual: 200000,
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

  it('las tarjetas de Nómina incluyen ⓘ de ayuda accesible', async () => {
    mockGet.mockImplementation(nominaApiMock);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));

    expect(
      await screen.findByRole('button', { name: 'Qué significa Próximo pago estimado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qué significa Total comisiones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qué significa Pendientes' })).toBeInTheDocument();
  });

  it('filtra los pendientes por empleada (con opción "Todas")', async () => {
    const rows = [
      {
        empleadaId: 1,
        nombre: 'Ana',
        totalComisionesPendientes: 100000,
        totalPropinas: 0,
        bonoHorario: 0,
        sueldoFijo: 0,
        sueldoFijoMensual: 0,
        porcentajeComisionServicio: 0,
        totalAPagar: 100000,
        cantidadRegistros: 3,
        periodoInicio: '2026-08-01T05:00:00.000Z',
        periodoFin: '2026-08-16T05:00:00.000Z',
        frecuenciaPago: 'QUINCENAL',
      },
      {
        empleadaId: 2,
        nombre: 'Beto',
        totalComisionesPendientes: 200000,
        totalPropinas: 0,
        bonoHorario: 0,
        sueldoFijo: 0,
        sueldoFijoMensual: 0,
        porcentajeComisionServicio: 0,
        totalAPagar: 200000,
        cantidadRegistros: 7,
        periodoInicio: '2026-08-01T05:00:00.000Z',
        periodoFin: '2026-08-16T05:00:00.000Z',
        frecuenciaPago: 'QUINCENAL',
      },
    ];
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/nomina/historial')) return Promise.resolve({ data: [] });
      if (url.includes('/finanzas/nomina')) return Promise.resolve({ data: rows });
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Beto' }] });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
      }
      return Promise.resolve({ data: {} });
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));

    // Both employee cards are visible by default.
    expect(await screen.findByText('3 servicios realizados')).toBeInTheDocument();
    expect(screen.getByText('7 servicios realizados')).toBeInTheDocument();

    const search = screen.getByPlaceholderText('🔍 Buscar empleada...');

    // Select Ana → only her card remains.
    fireEvent.focus(search);
    fireEvent.click(await screen.findByRole('option', { name: /Ana/ }));
    expect(screen.getByText('3 servicios realizados')).toBeInTheDocument();
    expect(screen.queryByText('7 servicios realizados')).not.toBeInTheDocument();

    // Switch to Beto (reopening the dropdown refetches the active employees).
    fireEvent.focus(search);
    fireEvent.click(await screen.findByRole('option', { name: /Beto/ }));
    expect(screen.queryByText('3 servicios realizados')).not.toBeInTheDocument();
    expect(screen.getByText('7 servicios realizados')).toBeInTheDocument();

    // Clearing the selection goes back to "all employees" (Todas).
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar empleada' }));
    expect(screen.getByText('3 servicios realizados')).toBeInTheDocument();
    expect(screen.getByText('7 servicios realizados')).toBeInTheDocument();
  });

  it('el filtro por empleada también aplica al historial de liquidaciones', async () => {
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(n)
        .replace(/\u00a0/g, ' ');

    const historialRows = [
      {
        id: 101,
        usuarioId: 1,
        totalComisiones: 0,
        totalPropinas: 0,
        sueldoFijo: 0,
        bonoHorario: 0,
        totalPagado: 111111,
        fechaDesde: '2026-08-01T05:00:00.000Z',
        fechaHasta: '2026-08-16T05:00:00.000Z',
        creadoEn: '2026-08-16T12:00:00.000Z',
      },
      {
        id: 102,
        usuarioId: 2,
        totalComisiones: 0,
        totalPropinas: 0,
        sueldoFijo: 0,
        bonoHorario: 0,
        totalPagado: 222222,
        fechaDesde: '2026-08-01T05:00:00.000Z',
        fechaHasta: '2026-08-16T05:00:00.000Z',
        creadoEn: '2026-08-16T12:00:00.000Z',
      },
    ];
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/nomina/historial')) return Promise.resolve({ data: historialRows });
      if (url.includes('/finanzas/nomina')) return Promise.resolve({ data: [] });
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Beto' }] });
      }
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
      }
      return Promise.resolve({ data: {} });
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Historial' }));

    expect(await screen.findByText(fmt(111111))).toBeInTheDocument();
    expect(screen.getByText(fmt(222222))).toBeInTheDocument();

    // Filter by Ana through the searchable employee selector (active employees).
    const search = screen.getByPlaceholderText('🔍 Buscar empleada...');
    fireEvent.focus(search);
    fireEvent.click(await screen.findByRole('option', { name: /Ana/ }));

    // After filtering, only Ana's liquidation remains (the amount also shows in "Total filtrado").
    expect(screen.getAllByText(fmt(111111)).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(fmt(222222))).not.toBeInTheDocument();
  });
});

describe('FinanzasPage — modal auditoría (período editable / pago fuera de ciclo)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  const pendienteSemanal: Record<string, unknown> = {
    empleadaId: 1,
    nombre: 'Ana',
    totalComisionesPendientes: 30000,
    totalPropinas: 5000,
    bonoHorario: 12500,
    sueldoFijo: 50000,
    sueldoFijoMensual: 200000,
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

  it('precarga Desde/Hasta con el período REAL de la fila (semana), no el mes completo', async () => {
    auditApiMock();
    await openAuditModal();

    // El default es el período de la frecuencia (SEMANAL: lunes 10 → domingo 16),
    // porque el fin de período del backend es EXCLUSIVO (17/08 05:00 UTC).
    expect(screen.getByLabelText('Período desde')).toHaveValue('2026-08-10');
    expect(screen.getByLabelText('Período hasta')).toHaveValue('2026-08-16');

    // El sueldo fijo mensual se muestra como aclaración (prorrateado por frecuencia SEMANAL)
    expect(screen.getByText(/sueldo fijo se guarda como valor mensual/i)).toBeInTheDocument();
  });

  it('empleada QUINCENAL: default = quincena real (01→15) y chips consistentes', async () => {
    const quincenal = {
      empleadaId: 7,
      nombre: 'Lucely',
      totalComisionesPendientes: 120000,
      totalPropinas: 0,
      bonoHorario: 0,
      sueldoFijo: 500000,
      sueldoFijoMensual: 1000000,
      porcentajeComisionServicio: 40,
      totalAPagar: 620000,
      cantidadRegistros: 0,
      periodoInicio: '2026-08-01T05:00:00.000Z',
      periodoFin: '2026-08-16T05:00:00.000Z', // exclusivo → 15/08 inclusivo
      frecuenciaPago: 'QUINCENAL',
    };
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/nomina/historial')) return Promise.resolve({ data: [] });
      if (url.includes('/finanzas/nomina')) return Promise.resolve({ data: [quincenal] });
      if (url.includes('/prestamos')) return Promise.resolve({ data: { data: [] } });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } } });
      }
      return Promise.resolve({ data: {} });
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Auditar y Liquidar' }));
    await screen.findByText('Auditoría pre-liquidación');

    // QUINCENAL: 01 → 15/08 (el fin de período llega como borde exclusivo 16/08 05:00 UTC).
    expect(screen.getByLabelText('Período desde')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Período hasta')).toHaveValue('2026-08-15');

    // Chips inequívocos: el sueldo es el del período y la comisión es la config actual.
    expect(screen.getByText(/Sueldo fijo del período/i)).toBeInTheDocument();
    expect(screen.getByText(/Comisión actual: 40%/i)).toBeInTheDocument();

    // La nota de prorrateo sigue siendo correcta para la frecuencia.
    expect(screen.getByText(/sueldo fijo se guarda como valor mensual/i)).toBeInTheDocument();
    expect(screen.getByText(/QUINCENAL →/i)).toBeInTheDocument();
  });

  it('con el período de la semana por defecto solo muestra registros de la semana; editar Hasta re-filtra', async () => {
    auditApiMock();
    await openAuditModal();

    // Default = semana (10→16/08) → solo el registro del 11/08; el del 20/08 queda fuera.
    expect(await screen.findByText('Manicure Básico')).toBeInTheDocument();
    expect(screen.queryByText('Manicure Avanzado')).toBeNull();
    expect(screen.getByText('1 registros')).toBeInTheDocument();

    // Extender Hasta al 31/08 → el registro del 20/08 entra al detalle.
    fireEvent.change(screen.getByLabelText('Período hasta'), {
      target: { value: '2026-08-31' },
    });

    await waitFor(() => {
      expect(screen.getByText('Manicure Avanzado')).toBeInTheDocument();
    });
    expect(screen.getByText('2 registros')).toBeInTheDocument();
  });

  it('confirmar la liquidación pide confirmación antes del POST y envía el período EDITADO en bordes Colombia', async () => {
    auditApiMock();
    mockPost.mockResolvedValue({ data: {} });
    await openAuditModal();

    fireEvent.change(screen.getByLabelText('Período desde'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('Período hasta'), {
      target: { value: '2026-08-20' },
    });

    // Primer clic: NO debe POSTear todavía, solo abrir la confirmación.
    fireEvent.click(screen.getByRole('button', { name: '✅ Confirmar liquidación' }));
    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.getByText(/¿Confirmar la liquidación de Ana/i)).toBeInTheDocument();

    // Confirmación explícita → recién ahora se POSTea.
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

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

    // El default (semana 10→16) NO solapa la liquidación 01→09.
    expect(screen.queryByRole('alert')).toBeNull();

    // Editar Desde al 01/08 → el rango 01→16 SÍ solapa la liquidación 01→09.
    fireEvent.change(screen.getByLabelText('Período desde'), {
      target: { value: '2026-08-01' },
    });

    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText(/#5/i)).toBeInTheDocument();
    expect(alerta).toHaveTextContent(/comp fijo podría pagarse nuevamente/i);

    // Acotar Desde al 10/08 → el rango 10→16 ya no solapa la liquidación 01→09.
    fireEvent.change(screen.getByLabelText('Período desde'), {
      target: { value: '2026-08-10' },
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('liquidación: saldo del préstamo con formatCurrency y descuento con MoneyInput (COP entero)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/nomina/historial')) return Promise.resolve({ data: [] });
      if (url.includes('/finanzas/nomina')) return Promise.resolve({ data: [pendienteSemanal] });
      if (url.includes('/prestamos')) {
        return Promise.resolve({
          data: { data: [{ id: 3, usuarioId: 1, motivo: 'Compra insumos', saldoPendiente: 150000, estado: 'ACTIVO' }] },
        });
      }
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        return Promise.resolve({
          data: { data: [registroDentroSemana], meta: { page: 1, limit: 50, total: 1, totalPages: 1 } },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Auditar y Liquidar' }));
    await screen.findByText('Auditoría pre-liquidación');

    // Saldo formateado con formatCurrency (COP es-CO, sin decimales)
    expect(await screen.findByText('Saldo: $ 150.000')).toBeInTheDocument();
    // El input del descuento es un MoneyInput: precarga 150000 con separador de miles
    const descuentoInput = screen.getByDisplayValue('150.000');
    // Editar con dígitos → el monto a descontar cambia
    fireEvent.change(descuentoInput, { target: { value: '50000' } });
    expect(screen.getByDisplayValue('50.000')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('150.000')).not.toBeInTheDocument();
  });

  it('quita la tarjeta y la fila de Propinas de la auditoría (el salón no acepta propinas)', async () => {
    auditApiMock();
    await openAuditModal();

    const dialog = screen.getByRole('dialog', { name: 'Auditoría pre-liquidación' });
    // No tip card and no tip line inside the modal.
    expect(within(dialog).queryByText('Propinas')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('🎁')).not.toBeInTheDocument();

    // Total bruto no longer includes tips: periodo de la semana → 30000 comisiones + 62500 bono+sueldo.
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(n)
        .replace(/\u00a0/g, ' ');
    expect(within(dialog).getByText('Total bruto')).toBeInTheDocument();
    // 30000 comisiones + 62500 bono+sueldo: la propina (5000) NO entra al total bruto.
    expect(within(dialog).getByText(fmt(92500))).toBeInTheDocument();
  });

  it('pide el rango de fechas al server y totaliza TODOS los registros del período (sin cap de 50)', async () => {
    // > límite viejo (50) y > página de fetch (100) → prueba cap + paginado.
    const TOTAL = 120;
    const registros = Array.from({ length: TOTAL }, (_, i) => ({
      ...registroDentroSemana,
      id: 1000 + i,
      clienteId: i + 1,
      comisionCalculada: 1000,
      creadoEn: '2026-08-15T10:00:00.000Z',
      actualizadoEn: '2026-08-15T10:00:00.000Z',
    }));

    mockGet.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/nomina/historial')) return Promise.resolve({ data: [] });
      if (url.includes('/finanzas/nomina')) return Promise.resolve({ data: [pendienteSemanal] });
      if (url.includes('/prestamos')) return Promise.resolve({ data: { data: [] } });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        // El server honra page/limit: con el cap viejo (50) devolvería 50, no 120.
        const page = Number(config?.params?.page ?? 1);
        const limit = Number(config?.params?.limit ?? 0);
        const start = limit > 0 ? (page - 1) * limit : 0;
        const slice = limit > 0 ? registros.slice(start, start + limit) : registros;
        return Promise.resolve({
          data: {
            data: slice,
            meta: {
              page,
              limit,
              total: registros.length,
              totalPages: Math.ceil(registros.length / (limit || registros.length)),
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    await openAuditModal();

    // El fetch del modal lleva el rango del período real de la fila (semana) y estado=ACTIVOS.
    const auditCall = mockGet.mock.calls.find(
      ([u, c]) => String(u).endsWith('/registros') && c?.params?.usuarioId === 1,
    );
    expect(auditCall).toBeTruthy();
    expect(auditCall![1].params).toMatchObject({
      usuarioId: 1,
      estado: 'ACTIVOS',
      desde: '2026-08-10',
      hasta: '2026-08-16',
    });

    // Totales sobre el set COMPLETO (120 × 1000), no los 50 del cap viejo.
    expect(await screen.findByText('120 registros')).toBeInTheDocument();
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(n)
        .replace(/\u00a0/g, ' ');
    const dialog = screen.getByRole('dialog', { name: 'Auditoría pre-liquidación' });
    // Los totales suman el set completo (120 × 1000), no el cap viejo de 50.
    expect(within(dialog).getAllByText(fmt(120000)).length).toBeGreaterThan(0);
    expect(within(dialog).queryAllByText(fmt(50000)).length).toBe(0);
  });

  it('liquidación exitosa: muestra toast de confirmación y cierra el modal', async () => {
    auditApiMock();
    mockPost.mockResolvedValue({ data: { id: 99 } });
    await openAuditModal();

    fireEvent.click(screen.getByRole('button', { name: '✅ Confirmar liquidación' }));
    // Aún no hay POST hasta confirmar explícitamente.
    expect(mockPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    expect(
      await screen.findByText(/Liquidación de Ana registrada correctamente/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Auditoría pre-liquidación')).toBeNull();
    });
  });

  it('liquidación fallida: toast de error y la fila sigue pendiente (sin cambio optimista)', async () => {
    auditApiMock();
    mockPost.mockRejectedValue({
      response: { data: { error: { message: 'CAJA_CERRADA' } } },
    });
    await openAuditModal();

    fireEvent.click(screen.getByRole('button', { name: '✅ Confirmar liquidación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    // Toast de error + el error inline del backend.
    expect(
      await screen.findByText(/No se pudo registrar la liquidación/i),
    ).toBeInTheDocument();
    // El modal permanece abierto (no hubo cierre optimista).
    expect(screen.getByText('Auditoría pre-liquidación')).toBeInTheDocument();

    // Al cerrar, la empleada sigue listada como pendiente (la fila NO se removió).
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('button', { name: 'Auditar y Liquidar' })).toBeInTheDocument();
  });
});

describe('FinanzasPage — errores de mutación visibles en la UI', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  function registroMock(registro: unknown) {
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
        return Promise.resolve({
          data: { data: [registro], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
        });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
  }

  it('anular registro: muestra el error del backend inline cuando la API rechaza', async () => {
    registroMock({
      id: 42,
      salonId: 1,
      clienteId: 1,
      usuarioId: 2,
      totalServicios: 50000,
      totalProductos: 0,
      montoTotal: 50000,
      montoPendiente: 0,
      propina: 0,
      comisionCalculada: 0,
      esRetoque: false,
      descripcionServicio: null,
      estaPagadaEmpleada: false,
      estado: 'ACTIVO',
      creadoEn: '2026-08-01T12:00:00.000Z',
      actualizadoEn: '2026-08-01T12:00:00.000Z',
      pagos: [],
      divisiones: [],
      _clienteNombre: 'Ana Gómez',
    });
    mockDelete.mockRejectedValue({
      response: { data: { error: { message: 'No se puede anular este registro' } } },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Anular' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, anular' }));

    expect(await screen.findByText(/No se puede anular este registro/)).toBeInTheDocument();
    // El modal de confirmación permanece abierto
    expect(screen.getByText('Anular registro')).toBeInTheDocument();
  }, 20000);

  it('borrar gasto: muestra el error inline cuando la API rechaza', async () => {
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
      if (url.includes('/gastos')) {
        return Promise.resolve({
          data: {
            data: [{ id: 7, descripcion: 'Arriendo local', monto: 200000, categoria: 'ARRIENDO', fecha: '2026-08-05T12:00:00.000Z', metodoPago: 'TRANSFERENCIA', esGastoFijo: true }],
            meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
          },
        });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    mockDelete.mockRejectedValue({
      response: { data: { message: 'El gasto ya fue conciliado y no se puede eliminar' } },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '💸 Gastos' }));
    // La fila del gasto tiene un botón con aria-label "Eliminar"; abre el modal
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    // El modal de confirmación tiene su propio botón "Eliminar" (el 2º en el DOM)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Eliminar' }))[1]);

    expect(await screen.findByText(/El gasto ya fue conciliado y no se puede eliminar/)).toBeInTheDocument();
  }, 20000);

  it('crear gasto: muestra el error inline cuando la API rechaza', async () => {
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
      if (url.includes('/gastos')) {
        return Promise.resolve({
          data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } },
        });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    mockPost.mockRejectedValue({
      response: { data: { message: 'No se puede crear el gasto en una caja cerrada' } },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '💸 Gastos' }));
    fireEvent.click(await screen.findByRole('button', { name: '+ Nuevo gasto' }));

    fireEvent.change(screen.getByPlaceholderText('Ej: Compra de tintes'), {
      target: { value: 'Tintes nuevos' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], {
      target: { value: '50000' },
    });

    // Hay dos "Registrar gasto" (estado vacío + modal): usar el del modal
    fireEvent.click((await screen.findAllByRole('button', { name: 'Registrar gasto' }))[1]);

    expect(await screen.findByText(/No se puede crear el gasto en una caja cerrada/)).toBeInTheDocument();
    // El modal permanece abierto para corregir
    expect(screen.getByText('Nuevo gasto')).toBeInTheDocument();
  }, 20000);
});

describe('FinanzasPage — tabs filtrados por rol', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  function rolApiMock(user: IUser) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: user });
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

  it('RECEPCIONISTA: ve SOLO el tab Registros (sin Caja/Nómina/Cuentas/Reportes/Gastos)', async () => {
    rolApiMock(recepcionista);

    renderPage();

    expect(await screen.findByRole('button', { name: '📋 Registros' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: '💰 Caja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '👩‍💼 Nómina' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '📊 Reportes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '💳 Cuentas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '💸 Gastos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '↩️ Devoluciones' })).not.toBeInTheDocument();
  });

  it('CONTADOR: ve todos los tabs excepto Caja', async () => {
    rolApiMock(contador);

    renderPage();

    expect(await screen.findByRole('button', { name: '📋 Registros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '👩‍💼 Nómina' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📊 Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '💳 Cuentas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '💸 Gastos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '↩️ Devoluciones' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: '💰 Caja' })).not.toBeInTheDocument();
  });

  it('MANICURISTA: ve SOLO el tab Registros (sin Caja/Gastos/Reportes)', async () => {
    rolApiMock(manicurista);

    renderPage();

    expect(await screen.findByRole('button', { name: '📋 Registros' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '💰 Caja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '💸 Gastos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '📊 Reportes' })).not.toBeInTheDocument();
  });
});

describe('FinanzasPage — fechaHora en registros (PR3 backfill)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  const baseRegistro = {
    id: 1,
    salonId: 1,
    clienteId: 1,
    usuarioId: 2,
    totalServicios: 50000,
    totalProductos: 0,
    montoTotal: 50000,
    montoPendiente: 0,
    propina: 0,
    comisionCalculada: 0,
    esRetoque: false,
    descripcionServicio: null,
    estaPagadaEmpleada: false,
    pagos: [],
    divisiones: [],
    _clienteNombre: 'Ana Gómez',
    _empleadaNombre: 'Dueña Test',
  };

  function registrosApiMock(registros: unknown[]) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        return Promise.resolve({
          data: { data: registros, meta: { page: 1, limit: 12, total: registros.length, totalPages: 1 } },
        });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
  }

  it('la fila de Registros muestra fechaHora (fecha de negocio) en vez de creadoEn', async () => {
    const registroBackfilleado = {
      ...baseRegistro,
      id: 1,
      // Backfill: fecha de negocio 16/08, cargado el 22/08
      fechaHora: '2026-08-16T12:00:00',
      creadoEn: '2026-08-22T12:00:00',
      actualizadoEn: '2026-08-22T12:00:00',
    };
    registrosApiMock([registroBackfilleado]);

    renderPage();

    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument();
    // La columna Fecha usa la fecha de negocio (16/08), NO el timestamp de auditoría (22/08)
    expect(screen.getByText('16-08-2026')).toBeInTheDocument();
    expect(screen.queryByText('22-08-2026')).toBeNull();
  });

  it('sin fechaHora, la fila cae al fallback creadoEn (legacy intacto)', async () => {
    const registroLegacy = {
      ...baseRegistro,
      id: 2,
      _clienteNombre: 'Lina Pérez',
      // Sin fechaHora: fila legacy → COALESCE(fechaHora, creadoEn) en la UI
      creadoEn: '2026-08-01T12:00:00',
      actualizadoEn: '2026-08-01T12:00:00',
    };
    registrosApiMock([registroLegacy]);

    renderPage();

    expect(await screen.findByText('Lina Pérez')).toBeInTheDocument();
    expect(screen.getByText('01-08-2026')).toBeInTheDocument();
  });
});

describe('FinanzasPage — móvil (cards ≤600px, D4/D5)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    setMobileMedia(true);
  });

  const REGISTROS_LABELS = ['#', 'Fecha', 'Hora', 'Cliente', 'Empleada', 'Servicios', 'Productos', 'Dto.%', 'Ajustado', 'Total', 'Método de pago', 'Estado', 'Acciones'];
  const GASTOS_LABELS = ['Descripción', 'Categoría', 'Monto', 'Fecha', 'Acciones'];
  const COBRAR_LABELS = ['Cliente / Préstamo', 'Tipo', 'Deuda total', 'Registros', 'Antigüedad', 'Acciones'];
  const PAGAR_LABELS = ['Empleada', 'Pendiente', 'Liquidado acumulado', 'Sueldo fijo', 'Comisión %'];

  const registroFila = {
    id: 1,
    salonId: 1,
    clienteId: 1,
    usuarioId: 2,
    totalServicios: 50000,
    totalProductos: 0,
    montoTotal: 50000,
    montoPendiente: 0,
    propina: 0,
    comisionCalculada: 0,
    esRetoque: false,
    descripcionServicio: null,
    estaPagadaEmpleada: false,
    creadoEn: '2026-08-01T12:00:00.000Z',
    actualizadoEn: '2026-08-01T12:00:00.000Z',
    pagos: [],
    divisiones: [],
    _clienteNombre: 'Ana Gómez',
    _empleadaNombre: 'Dueña Test',
  };

  const registroFila2 = {
    ...registroFila,
    id: 2,
    clienteId: 2,
    _clienteNombre: 'Lina Pérez',
    totalProductos: 15000,
    montoTotal: 65000,
    estado: 'ACTIVO',
  };

  const cuentasCobrarMovil = [
    { id: 1, tipo: 'CLIENTE', nombre: 'Ana Gómez', deudaTotal: 120000, cantidadRegistros: 2, antiguedadDias: 45, antiguedadBucket: '31-60' },
    { id: 99, tipo: 'PRESTAMO', nombre: 'Luis Ramírez', deudaTotal: 85000, cantidadRegistros: null, antiguedadDias: 3, antiguedadBucket: '0-30' },
  ];

  const cuentasPagarMovil = [
    { empleadaId: 3, nombre: 'María Torres', sueldoFijo: 800000, porcentajeComisionServicio: 30, pendienteActual: 298000, liquidadoAcumulado: 550000, alDia: false },
    { empleadaId: 4, nombre: 'Sofía Ruiz', sueldoFijo: 0, porcentajeComisionServicio: 40, pendienteActual: 0, liquidadoAcumulado: 200000, alDia: true },
  ];

  const cuentasResponseMovil = (data: unknown[], total: number) => ({
    data: {
      ok: true,
      data: {
        data,
        meta: { page: 1, limit: 12, total, totalPages: Math.max(1, Math.ceil(total / 12)) },
      },
    },
  });

  function mobileApiMock(url: string): Promise<unknown> {
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
      return Promise.resolve({ data: { data: [registroFila, registroFila2], meta: { page: 1, limit: 12, total: 2, totalPages: 1 } } });
    }
    if (url.includes('/gastos')) {
      return Promise.resolve({
        data: {
          data: [{ id: 7, descripcion: 'Arriendo local', monto: 200000, categoria: 'ARRIENDO', fecha: '2026-08-05T12:00:00.000Z', metodoPago: 'TRANSFERENCIA', esGastoFijo: true }],
          meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
        },
      });
    }
    if (url.includes('/finanzas/cuentas/cobrar')) {
      return Promise.resolve(cuentasResponseMovil(cuentasCobrarMovil, cuentasCobrarMovil.length));
    }
    if (url.includes('/finanzas/cuentas/pagar')) {
      return Promise.resolve(cuentasResponseMovil(cuentasPagarMovil, cuentasPagarMovil.length));
    }
    if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  }

  function renderMobilePage() {
    mockGet.mockImplementation(mobileApiMock);
    return render(
      <MemoryRouter initialEntries={['/finanzas']}>
        <FinanzasPage />
      </MemoryRouter>,
    );
  }

  it('cada celda de Registros expone su data-label en orden (contrato de cards móviles)', async () => {
    renderMobilePage();

    await screen.findByText('Ana Gómez');
    await screen.findByText('Lina Pérez');
    const rows = await screen.findAllByRole('row');
    // thead + 2 filas de datos
    expect(rows).toHaveLength(3);
    rows.slice(1).forEach((row) => {
      const cells = within(row).getAllByRole('cell');
      expect(cells).toHaveLength(REGISTROS_LABELS.length);
      cells.forEach((cell, i) => {
        expect(cell).toHaveAttribute('data-label', REGISTROS_LABELS[i]);
      });
    });
  });

  it('cada celda de Gastos expone su data-label en orden (contrato de cards móviles)', async () => {
    renderMobilePage();

    fireEvent.click(await screen.findByRole('button', { name: '💸 Gastos' }));
    await screen.findByText('Arriendo local');

    const fila = screen.getByText('Arriendo local').closest('tr')!;
    const cells = within(fila).getAllByRole('cell');
    expect(cells).toHaveLength(GASTOS_LABELS.length);
    cells.forEach((cell, i) => {
      expect(cell).toHaveAttribute('data-label', GASTOS_LABELS[i]);
    });
  });

  it('cada celda de Cuentas (Cobrar y Pagar) expone su data-label en orden (contrato de cards móviles)', async () => {
    renderMobilePage();

    fireEvent.click(await screen.findByRole('button', { name: '💳 Cuentas' }));
    await screen.findByText('Ana Gómez');

    const ana = screen.getByText('Ana Gómez');
    const anaRow = ana.closest('tr')!;
    const anaCells = within(anaRow).getAllByRole('cell');
    expect(anaCells).toHaveLength(COBRAR_LABELS.length);
    anaCells.forEach((cell, i) => {
      expect(cell).toHaveAttribute('data-label', COBRAR_LABELS[i]);
    });

    fireEvent.click(screen.getByRole('button', { name: /por pagar/i }));
    const maria = await screen.findByText('María Torres');
    const mariaRow = maria.closest('tr')!;
    const mariaCells = within(mariaRow).getAllByRole('cell');
    expect(mariaCells).toHaveLength(PAGAR_LABELS.length);
    mariaCells.forEach((cell, i) => {
      expect(cell).toHaveAttribute('data-label', PAGAR_LABELS[i]);
    });

    const sofia = screen.getByText('Sofía Ruiz');
    const sofiaRow = sofia.closest('tr')!;
    const sofiaCells = within(sofiaRow).getAllByRole('cell');
    expect(sofiaCells).toHaveLength(PAGAR_LABELS.length);
    sofiaCells.forEach((cell, i) => {
      expect(cell).toHaveAttribute('data-label', PAGAR_LABELS[i]);
    });
  });

  it('el modal de detalle de Registro usa las clases bottom-sheet en móvil (D10)', async () => {
    renderMobilePage();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalle' }))[0]);

    const overlay = await waitFor(() => document.querySelector('.mobileBottomSheet'));
    const panel = document.querySelector('.mobileBottomSheetContent');
    expect(overlay).not.toBeNull();
    expect(panel).not.toBeNull();
  });

  it('filtro por estado server-side: Activos→sin anulados; Anulados→solo anulados; Todos→ambos', async () => {
    const anulado = { ...registroFila, id: 3, estado: 'ANULADO', _clienteNombre: 'Rosa Anulada' };
    const responseFor = (rows: unknown[]) => ({
      data: { data: rows, meta: { page: 1, limit: 12, total: rows.length, totalPages: 1 } },
    });
    // PR5: el filtro de estado es server-side. El mock responde según el param
    // `estado` que envía el componente (antes filtraba client-side con 3 filas fijas).
    const mockWithAnulado = (
      url: string,
      config?: { params?: Record<string, string> },
    ): Promise<unknown> => {
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
        const estado = config?.params?.estado;
        if (estado === 'ACTIVOS') return Promise.resolve(responseFor([registroFila, registroFila2]));
        if (estado === 'ANULADOS') return Promise.resolve(responseFor([anulado]));
        return Promise.resolve(responseFor([registroFila, registroFila2, anulado]));
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    };

    mockGet.mockImplementation(mockWithAnulado);
    render(
      <MemoryRouter initialEntries={['/finanzas']}>
        <FinanzasPage />
      </MemoryRouter>,
    );

    // Default: Activos → el server no devuelve anulados
    const select = await screen.findByLabelText('Filtrar por estado de registro');
    expect(select).toHaveValue('ACTIVOS');
    await screen.findByText('Ana Gómez');
    expect(screen.getByText('Lina Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Rosa Anulada')).toBeNull();

    // Anulados → el server devuelve solo anulados
    fireEvent.change(select, { target: { value: 'ANULADOS' } });
    expect(await screen.findByText('Rosa Anulada')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Ana Gómez')).toBeNull());

    // Todos → el server devuelve los 3
    fireEvent.change(screen.getByLabelText('Filtrar por estado de registro'), { target: { value: 'TODOS' } });
    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.getByText('Rosa Anulada')).toBeInTheDocument();
  });

  it('deshabilita Anular cuando la caja del día del registro está CERRADA (regla dueño)', async () => {
    const conCajaCerrada = {
      ...registroFila,
      id: 90,
      cajaId: 12,
      cajaAbierta: false,
      _clienteNombre: 'Caja Cerrada',
    };
    const conCajaAbierta = {
      ...registroFila2,
      id: 91,
      cajaId: 13,
      cajaAbierta: true,
      _clienteNombre: 'Caja Abierta',
    };
    const mockConCajas = (url: string): Promise<unknown> => {
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
        return Promise.resolve({ data: { data: [conCajaCerrada, conCajaAbierta], meta: { page: 1, limit: 12, total: 2, totalPages: 1 } } });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    };

    mockGet.mockImplementation(mockConCajas);
    render(
      <MemoryRouter initialEntries={['/finanzas']}>
        <FinanzasPage />
      </MemoryRouter>,
    );

    await screen.findByText('Caja Cerrada');
    await screen.findByText('Caja Abierta');

    // La fila con caja cerrada tiene el botón deshabilitado con aria-label de bloqueo
    const bloqueado = await screen.findByLabelText('Anular bloqueado (caja cerrada)');
    expect(bloqueado).toBeDisabled();

    // La fila con caja abierta mantiene el botón Anular habilitado
    const habilitado = screen.getByLabelText('Anular');
    expect(habilitado).not.toBeDisabled();
  });
});

describe('FinanzasPage — Nómina: insumo informativo por rol (PR3)', () => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/\u00a0/g, ' ');

  const etiqueta = 'Insumos (ya descontados de la comisión)';

  const nominaRow = (overrides: Record<string, unknown> = {}) => ({
    empleadaId: 1,
    nombre: 'Lucía',
    totalComisionesPendientes: 267600,
    totalPropinas: 0,
    bonoHorario: 0,
    sueldoFijo: 0,
    sueldoFijoMensual: 0,
    porcentajeComisionServicio: 60,
    totalAPagar: 267600,
    cantidadRegistros: 1,
    periodoInicio: '2026-09-01T05:00:00.000Z',
    periodoFin: '2026-09-30T05:00:00.000Z',
    frecuenciaPago: 'MENSUAL',
    totalCostoBaseInsumos: 84000,
    ...overrides,
  });

  function nominaApiMock(user: IUser, rows: unknown[]) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: user });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/finanzas/nomina/historial')) return Promise.resolve({ data: [] });
      if (url.includes('/finanzas/nomina')) return Promise.resolve({ data: rows });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/registros')) {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
      }
      return Promise.resolve({ data: {} });
    });
  }

  async function openNomina() {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '👩‍💼 Nómina' }));
    // The employee filter renders names as <option>, so 'Lucía' is no longer unique.
    await screen.findAllByText('Lucía');
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  it('DUEÑA ve la etiqueta informativa con $84000 y la tarjeta resumen', async () => {
    nominaApiMock(duena, [nominaRow()]);

    await openNomina();

    expect(screen.getByText(etiqueta)).toBeInTheDocument();
    // El valor aparece en la fila de la empleada y en la tarjeta resumen.
    expect(screen.getAllByText(fmt(84000)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('🧴 Total insumos')).toBeInTheDocument();
    // La comisión/total no cambian por mostrar el insumo.
    expect(screen.getAllByText(fmt(267600)).length).toBeGreaterThanOrEqual(1);
  });

  it('MANICURISTA (operativa) no accede al tab Nómina ni ve el insumo informativo', async () => {
    nominaApiMock(manicurista, [nominaRow()]);

    renderPage();

    // El tab Nómina ya no está disponible: la operativa solo ve Registros
    expect(await screen.findByRole('button', { name: '📋 Registros' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '👩‍💼 Nómina' })).toBeNull();
    // Ni la etiqueta informativa ni la tarjeta resumen de insumos
    expect(screen.queryByText(etiqueta)).not.toBeInTheDocument();
    expect(screen.queryByText('🧴 Total insumos')).not.toBeInTheDocument();
  });

  it('sin el campo totalCostoBaseInsumos la etiqueta NO se renderiza (consumidores viejos)', async () => {
    nominaApiMock(duena, [nominaRow({ totalCostoBaseInsumos: undefined })]);

    await openNomina();

    expect(screen.queryByText(etiqueta)).not.toBeInTheDocument();
  });
});

describe('FinanzasPage — Registros: paginación server-side por estado/tipo (PR5)', () => {
  function registroRow(
    overrides: Partial<{ id: number; estado: string }> = {},
  ) {
    return {
      id: overrides.id ?? 1,
      salonId: 1,
      clienteId: 1,
      usuarioId: 2,
      totalServicios: 100000,
      totalProductos: 0,
      montoTotal: 100000,
      montoPendiente: 0,
      propina: 0,
      comisionCalculada: 0,
      esRetoque: false,
      descripcionServicio: null,
      estaPagadaEmpleada: false,
      estado: overrides.estado ?? 'ACTIVO',
      creadoEn: '2026-09-10T15:00:00.000Z',
      actualizadoEn: '2026-09-10T15:00:00.000Z',
      pagos: [],
      divisiones: [],
    };
  }

  function registrosResponse(rows: ReturnType<typeof registroRow>[]) {
    return {
      data: {
        data: rows,
        meta: {
          page: 1,
          limit: 12,
          total: rows.length,
          totalPages: Math.max(1, Math.ceil(rows.length / 12)),
        },
      },
    };
  }

  // Fixture real del período 2026-09-04..2026-09-29 (salon 1): 15 activos,
  // 11 anulados, 26 total.
  const activos = Array.from({ length: 15 }, (_, i) => registroRow({ id: 100 + i }));
  const anulados = Array.from({ length: 11 }, (_, i) => registroRow({ id: 200 + i, estado: 'ANULADO' }));
  const todos = [...activos, ...anulados];

  function registrosApiMock() {
    mockGet.mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      if (url.includes('/registros')) {
        // Simula el backend YA CORREGIDO: filtra por el param `estado`.
        // Sin param (comportamiento viejo) devuelve los 26.
        const estado = config?.params?.estado;
        if (estado === 'ACTIVOS') return Promise.resolve(registrosResponse(activos));
        if (estado === 'ANULADOS') return Promise.resolve(registrosResponse(anulados));
        return Promise.resolve(registrosResponse(todos));
      }
      return Promise.resolve({ data: {} });
    });
  }

  const registrosCall = () =>
    mockGet.mock.calls.find(([u]) => String(u).endsWith('/registros'));

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  it('pide al servidor con estado=ACTIVOS y tipo=TODOS (filtro server-side)', async () => {
    registrosApiMock();

    renderPage();

    await waitFor(() => expect(registrosCall()).toBeTruthy());
    const [, config] = registrosCall()!;
    expect(config.params).toEqual(expect.objectContaining({ estado: 'ACTIVOS', tipo: 'TODOS' }));
  });

  it('la paginación muestra el total del servidor para el filtro activo (15), no el total sin filtrar', async () => {
    registrosApiMock();

    renderPage();

    expect(await screen.findByText(/15 registros/)).toBeInTheDocument();
    expect(screen.queryByText(/26 registros/)).not.toBeInTheDocument();
  });

  it('cambiar Activos→Anulados→Todos re-consulta y actualiza filas/total', async () => {
    registrosApiMock();

    renderPage();
    await screen.findByText(/15 registros/);
    const tableActivos = screen.getByRole('table');
    expect(within(tableActivos).getByText('100')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filtrar por estado de registro'), {
      target: { value: 'ANULADOS' },
    });
    await waitFor(() => {
      expect(
        mockGet.mock.calls.some(
          ([u, c]) => String(u).endsWith('/registros') && c?.params?.estado === 'ANULADOS',
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      const tableAnulados = screen.getByRole('table');
      expect(within(tableAnulados).getByText('200')).toBeInTheDocument();
      expect(within(tableAnulados).queryByText('100')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Filtrar por estado de registro'), {
      target: { value: 'TODOS' },
    });
    expect(await screen.findByText(/26 registros/)).toBeInTheDocument();
  });

  it('NO filtra client-side: renderiza todas las filas que devuelve el servidor (aunque venga una ANULADA)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      if (url.includes('/registros')) {
        return Promise.resolve(
          registrosResponse([registroRow({ id: 7 }), registroRow({ id: 8, estado: 'ANULADO' })]),
        );
      }
      return Promise.resolve({ data: {} });
    });

    renderPage();

    // Espera a que cargue la tabla real (el skeleton también es un <table>):
    // header + 2 filas. El componente NO descarta la fila ANULADA (id 8).
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });
    const table = screen.getByRole('table');
    expect(within(table).getByText('7')).toBeInTheDocument();
    expect(within(table).getByText('8')).toBeInTheDocument();
  });
});

describe('FinanzasPage — Registros: reconciliación Ingresos vs Caja (PR6 revisión)', () => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/\u00a0/g, ' ');

  function mockResumen(user: IUser, resumen: Record<string, unknown>) {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: user });
      if (url.includes('/caja/actual')) return Promise.reject(error404);
      if (url.includes('/caja/cierres')) {
        return Promise.resolve({
          data: { ok: true, data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } },
        });
      }
      if (url.includes('/registros')) {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } } });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: resumen });
      if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
      if (url.includes('/clientes')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    setMobileMedia(false);
  });

  it('renombra las tarjetas a "Ventas del día" y "Entró a caja" y elimina las etiquetas viejas', async () => {
    mockResumen(duena, { totalIngresos: 935000, totalCobrado: 940000, totalPropinas: 5000 });

    renderPage();

    const ventas = await screen.findByTestId('card-ventas-dia');
    expect(ventas).toHaveTextContent('Ventas del día');
    expect(screen.getByTestId('card-entro-caja')).toHaveTextContent('Entró a caja');
    expect(screen.queryByText(/TOTAL INGRESOS/)).not.toBeInTheDocument();
    expect(screen.queryByText('💰 Cobrado')).not.toBeInTheDocument();
  });

  it('expone un ⓘ enfocable y accesible en Ventas del día y Entró a caja', async () => {
    mockResumen(duena, { totalIngresos: 935000, totalCobrado: 940000, totalPropinas: 5000 });

    renderPage();

    const ventas = await screen.findByTestId('card-ventas-dia');
    const caja = screen.getByTestId('card-entro-caja');
    const ventasInfo = within(ventas).getByRole('button', { name: 'Qué significa Ventas del día' });
    const cajaInfo = within(caja).getByRole('button', { name: 'Qué significa Entró a caja' });

    // Alcanzables por teclado (elementos nativos enfocables)
    cajaInfo.focus();
    expect(document.activeElement).toBe(cajaInfo);
    ventasInfo.focus();
    expect(document.activeElement).toBe(ventasInfo);
  });

  it('el ⓘ de Ventas del día explica el devengado sin propinas e incluye lo fiado', async () => {
    mockResumen(duena, { totalIngresos: 935000, totalCobrado: 940000, totalPropinas: 5000 });

    renderPage();

    const ventas = await screen.findByTestId('card-ventas-dia');
    fireEvent.mouseOver(within(ventas).getByRole('button', { name: 'Qué significa Ventas del día' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/Lo que facturaste en el período/i);
    expect(tooltip).toHaveTextContent(/sin propinas/i);
    expect(tooltip).toHaveTextContent(/Incluye lo fiado \(todavía no cobrado\)/i);
  });

  it('el ⓘ de Entró a caja explica la caja real con propinas y deudas anteriores', async () => {
    mockResumen(duena, { totalIngresos: 935000, totalCobrado: 940000, totalPropinas: 5000 });

    renderPage();

    const caja = await screen.findByTestId('card-entro-caja');
    fireEvent.mouseOver(within(caja).getByRole('button', { name: 'Qué significa Entró a caja' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/La plata que realmente entró en el período/i);
    expect(tooltip).toHaveTextContent(/propinas y cobros de deudas anteriores/i);
    expect(tooltip).toHaveTextContent(/No cuenta lo fiado/i);
  });

  it('la tira de reconciliación SIEMPRE se renderiza (aunque Cobrado === Ingresos)', async () => {
    mockResumen(duena, { totalIngresos: 935000, totalCobrado: 935000, totalPropinas: 5000 });

    renderPage();

    const tira = await screen.findByTestId('tira-reconciliacion');
    expect(within(tira).getByText('Entró a caja')).toBeInTheDocument();
    // T3: propina rows are hidden while propinas are not accepted.
    expect(within(tira).queryByText('TU CAJA REAL (sin propinas)')).not.toBeInTheDocument();
    expect(within(tira).queryByText('Propinas (van a las chicas)')).not.toBeInTheDocument();
  });

  it('oculta las filas de componente en 0 y mantiene los cierres', async () => {
    mockResumen(duena, {
      totalIngresos: 50000,
      totalFiadoDia: 0,
      cobrosDeudaAnterior: 0,
      totalPropinas: 0,
      totalCobrado: 50000,
    });

    renderPage();

    const tira = await screen.findByTestId('tira-reconciliacion');
    expect(within(tira).queryByText('Quedó fiado')).not.toBeInTheDocument();
    expect(within(tira).queryByText('Deudas viejas que te pagaron')).not.toBeInTheDocument();
    expect(within(tira).queryByText('Propinas')).not.toBeInTheDocument();
    expect(within(tira).getByText('Entró a caja')).toBeInTheDocument();
    // T3: the propina closing rows are hidden from the UI.
    expect(within(tira).queryByText('Propinas (van a las chicas)')).not.toBeInTheDocument();
    expect(within(tira).queryByText('TU CAJA REAL (sin propinas)')).not.toBeInTheDocument();
  });

  it('T3: la fila "TU CAJA REAL" no se renderiza (lógica de la tira intacta, ocultamiento reversible)', async () => {
    mockResumen(duena, { totalCobrado: 940000, totalPropinas: 5000 });

    renderPage();

    await screen.findByTestId('tira-reconciliacion');
    expect(screen.queryByTestId('tira-row-caja-real')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tira-row-propinas-cierre')).not.toBeInTheDocument();
    // "Entró a caja" sigue visible como último cierre.
    expect(within(screen.getByTestId('tira-row-cobrado')).getByText(fmt(940000))).toBeInTheDocument();
  });

  it('reconcilia el día completo en orden (identidad del owner)', async () => {
    mockResumen(duena, {
      totalIngresos: 100000,
      totalFiadoDia: 40000,
      cobrosDeudaAnterior: 20000,
      totalPropinas: 5000,
      totalCobrado: 85000,
    });

    renderPage();

    const tira = await screen.findByTestId('tira-reconciliacion');
    const rowKeys = within(tira)
      .getAllByTestId(/^tira-row-/)
      .map((el) => el.getAttribute('data-testid'));
    // T3: propinas-cierre and caja-real are hidden; the component row remains
    // because its value is non-zero.
    expect(rowKeys).toEqual([
      'tira-row-ventas',
      'tira-row-fiado',
      'tira-row-cobros-anteriores',
      'tira-row-propinas',
      'tira-row-cobrado',
    ]);
    expect(within(screen.getByTestId('tira-row-ventas')).getByText(fmt(100000))).toBeInTheDocument();
    expect(within(screen.getByTestId('tira-row-fiado')).getByText(fmt(40000))).toBeInTheDocument();
    expect(within(screen.getByTestId('tira-row-cobros-anteriores')).getByText(fmt(20000))).toBeInTheDocument();
    expect(within(screen.getByTestId('tira-row-propinas')).getByText(fmt(5000))).toBeInTheDocument();
    expect(within(screen.getByTestId('tira-row-cobrado')).getByText(fmt(85000))).toBeInTheDocument();
  });

  it('resumen vacío → tira con cierres en $0 y sin componentes', async () => {
    mockResumen(duena, {});

    renderPage();

    const tira = await screen.findByTestId('tira-reconciliacion');
    expect(within(tira).getByText('Entró a caja')).toBeInTheDocument();
    expect(within(screen.getByTestId('tira-row-cobrado')).getByText(fmt(0))).toBeInTheDocument();
    expect(screen.queryByTestId('tira-row-caja-real')).not.toBeInTheDocument();
    expect(within(tira).queryByText('Ventas del día')).not.toBeInTheDocument();
  });

  it('NO agrega tarjetas: la tira vive fuera del summaryGrid y no aparece "🎁 Propinas"', async () => {
    mockResumen(duena, { totalIngresos: 935000, totalCobrado: 940000, totalPropinas: 5000 });

    const { container } = renderPage();

    const tira = await screen.findByTestId('tira-reconciliacion');
    expect(tira.closest('[class*="summaryCard"]')).toBeNull();
    expect(screen.queryByText('🎁 Propinas')).not.toBeInTheDocument();
    // Tarjetas del resumen para DUEÑA (3 tras quitar Servicios/Productos/Insumos, T4)
    expect(container.querySelectorAll('[class*="summaryCard"]')).toHaveLength(3);
  });

  it('las tarjetas Ventas del día/Entró a caja y la tira siguen visibles para rol no privilegiado', async () => {
    const recepcionista: IUser = { ...duena, id: 5, rol: Rol.RECEPCIONISTA };
    mockResumen(recepcionista, { totalIngresos: 935000, totalCobrado: 940000, totalPropinas: 5000 });

    renderPage();

    expect(await screen.findByTestId('card-ventas-dia')).toBeInTheDocument();
    expect(screen.getByTestId('card-entro-caja')).toBeInTheDocument();
    expect(screen.getByTestId('tira-reconciliacion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qué significa Entró a caja' })).toBeInTheDocument();
    // T4: las tarjetas movidas a Reportes no se renderizan para ningún rol.
    expect(screen.queryByText('💇 Servicios')).not.toBeInTheDocument();
    expect(screen.queryByText('🧴 Productos')).not.toBeInTheDocument();
    expect(screen.queryByText('🧴 Total insumos')).not.toBeInTheDocument();
  });

  it('mobile: la tira conserva orden de filas y wrapper (layout apilado en CSS)', async () => {
    setMobileMedia(true);
    mockResumen(duena, {
      totalIngresos: 100000,
      totalFiadoDia: 40000,
      cobrosDeudaAnterior: 20000,
      totalPropinas: 5000,
      totalCobrado: 85000,
    });

    const { container } = renderPage();

    const tira = await screen.findByTestId('tira-reconciliacion');
    // jsdom no aplica layout/CSS: no se puede asertar la AUSENCIA de scroll horizontal.
    // Verificación manual documentada: en viewport ≤480px las filas se apilan
    // (flex-direction: column) con flex-wrap + min-width:0 + overflow-wrap:anywhere
    // ⇒ la tira se encoge sin scroll horizontal y el texto permanece legible.
    expect(container.querySelector('[class*="tiraReconciliacion"]')).not.toBeNull();
    expect(within(tira).getByText('Ventas del día')).toBeInTheDocument();
    expect(within(tira).getByText('Entró a caja')).toBeInTheDocument();
    // T3: propina rows hidden in mobile too.
    expect(within(tira).queryByText('TU CAJA REAL (sin propinas)')).not.toBeInTheDocument();
    setMobileMedia(false);
  });
});

describe('FinanzasPage — detalle del registro (rediseño T2)', () => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/\u00a0/g, ' ');

  const registroDetalle = {
    id: 77,
    salonId: 1,
    clienteId: 1,
    usuarioId: 2,
    totalServicios: 60000,
    totalProductos: 25000,
    montoTotal: 85000,
    montoPendiente: 0,
    propina: 0,
    comisionCalculada: 18000,
    esRetoque: false,
    descripcionServicio: 'Corte y color',
    estaPagadaEmpleada: false,
    estado: 'ACTIVO',
    notas: 'Cliente frecuente',
    precioAjustado: true,
    porcentajeDescuento: 10,
    descuentoAlcance: 'SERVICIOS',
    valorOriginal: 90000,
    valorFinal: 85000,
    fechaHora: '2026-09-10T15:30:00.000Z',
    creadoEn: '2026-09-10T15:30:00.000Z',
    actualizadoEn: '2026-09-10T15:30:00.000Z',
    pagos: [
      { id: 1, monto: 90000, metodoPago: 'EFECTIVO', referencia: 'REF-1', creadoEn: '2026-09-10T15:30:00.000Z' },
    ],
    divisiones: [{ id: 1, usuarioId: 2, porcentajeParticipacion: 60, comisionCorrespondiente: 18000 }],
    productosVendidos: [
      { id: 5, productoId: 9, nombre: 'Aceite Argan', cantidad: 1, precioVentaUnitario: 25000, subtotal: 25000 },
    ],
    serviciosItems: [
      { id: 1, servicioId: 1, nombreServicio: 'Corte', precioServicio: 30000, costoBaseInsumos: 1500, gramosUsados: 10, precioPorGramo: 150 },
      { id: 2, servicioId: 2, nombreServicio: 'Color', precioServicio: 30000, costoBaseInsumos: 2000 },
    ],
    _clienteNombre: 'Ana Gómez',
    _empleadaNombre: 'Dueña Test',
  };

  function detalleApiMock(registro: Record<string, unknown>) {
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
        return Promise.resolve({
          data: { data: [registro], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
        });
      }
      if (url.includes('/finanzas/resumen')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
  }

  async function openDetail(registro: Record<string, unknown> = registroDetalle) {
    detalleApiMock(registro);
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalle' }))[0]);
    return screen.findByRole('dialog', { name: /Detalle del registro #77/ });
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    setMobileMedia(false);
  });

  it('muestra header con estado, cliente/empleada y fecha (sin Descripción)', async () => {
    const dialog = await openDetail();

    expect(within(dialog).getAllByText('Registro #77').length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText('Activo')).toBeInTheDocument();
    expect(within(dialog).getByText('Ana Gómez')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Dueña Test').length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText(/10\/09\/2026/)).toBeInTheDocument();
    // La Descripción se quitó: duplicaba los ítems de la tabla.
    expect(within(dialog).queryByText('Descripción')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Corte y color')).not.toBeInTheDocument();
  });

  it('presenta los ítems en una tabla con columnas y el detalle de insumos por línea', async () => {
    const dialog = await openDetail();

    expect(within(dialog).getByText('Ítems del registro')).toBeInTheDocument();

    const table = within(dialog).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Concepto' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Cant.' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Precio unit.' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Subtotal' })).toBeInTheDocument();

    expect(within(table).getByText('Corte')).toBeInTheDocument();
    expect(within(table).getByText('Color')).toBeInTheDocument();
    // POR_GRAMO line spells out grams × $/g; FIJO line shows the flat cost.
    expect(within(table).getByText(/Insumos: 10 g/)).toBeInTheDocument();
    expect(within(table).getByText(/Insumos:.*2\.000/)).toBeInTheDocument();
  });

  it('muestra el flujo de totales: precio original → descuento (%, alcance) → total final', async () => {
    const dialog = await openDetail();

    expect(within(dialog).getByText('Aceite Argan')).toBeInTheDocument();
    // Subtotals live in the items table footer (nothing is lost from the old view).
    expect(within(dialog).getByText('Subtotal servicios')).toBeInTheDocument();
    expect(within(dialog).getByText('Subtotal productos')).toBeInTheDocument();
    expect(within(dialog).getByText('Total ítems')).toBeInTheDocument();

    expect(within(dialog).getByText('Precio original')).toBeInTheDocument();
    expect(within(dialog).getByText('Descuento')).toBeInTheDocument();
    // Anchored: the header badge also contains "10% · servicios".
    expect(within(dialog).getByText(/^10% · servicios$/)).toBeInTheDocument();
    expect(within(dialog).getByText('Total final')).toBeInTheDocument();
    expect(within(dialog).getAllByText(fmt(85000)).length).toBeGreaterThanOrEqual(1);
  });

  it('sin descuento no muestra el flujo de descuento y conserva los totales limpios', async () => {
    const dialog = await openDetail({
      ...registroDetalle,
      precioAjustado: false,
      porcentajeDescuento: 0,
      valorOriginal: 85000,
      valorFinal: 85000,
    });

    expect(within(dialog).queryByText('Precio original')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Descuento')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Total final')).toBeInTheDocument();
    expect(within(dialog).getByText('Subtotal servicios')).toBeInTheDocument();
    expect(within(dialog).getByText('Subtotal productos')).toBeInTheDocument();
  });

  it('muestra los pagos con método/referencia/monto y el cambio', async () => {
    const dialog = await openDetail();

    expect(within(dialog).getByText('Pagos')).toBeInTheDocument();
    // "Efectivo" appears in both the payment row and the totals method row.
    expect(within(dialog).getAllByText('Efectivo').length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText(/Ref: REF-1/)).toBeInTheDocument();
    expect(within(dialog).getByText('Cambio:')).toBeInTheDocument();
  });

  it('usa el nombre legible de la empleada en las divisiones y muestra notas', async () => {
    const dialog = await openDetail();

    expect(within(dialog).getByText('Divisiones y comisión')).toBeInTheDocument();
    // usuarioId de la división === usuarioId del registro → nombre legible.
    expect(within(dialog).getAllByText('Dueña Test').length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText('60%')).toBeInTheDocument();
    expect(within(dialog).getByText('Notas')).toBeInTheDocument();
    expect(within(dialog).getByText('Cliente frecuente')).toBeInTheDocument();
  });

  it('no muestra la fila de propina cuando es 0', async () => {
    const dialog = await openDetail();
    expect(within(dialog).queryByText('Propina')).not.toBeInTheDocument();
  });

  it('muestra la propina cuando es mayor a 0', async () => {
    const dialog = await openDetail({ ...registroDetalle, propina: 5000 });

    expect(within(dialog).getByText('Propina')).toBeInTheDocument();
    expect(within(dialog).getAllByText(fmt(5000)).length).toBeGreaterThanOrEqual(1);
  });

  it('muestra el badge "Anulado" para un registro anulado', async () => {
    const dialog = await openDetail({ ...registroDetalle, estado: 'ANULADO' });
    expect(within(dialog).getByText('Anulado')).toBeInTheDocument();
  });
});
