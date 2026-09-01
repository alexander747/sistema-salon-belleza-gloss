import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet },
}));

import DashboardPage from '../DashboardPage';

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

/** Dashboard con datos: el resumen trae ingresos para no caer en el estado vacío. */
function apiConDatos(mensual: unknown[]) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/finanzas/mensual')) return Promise.resolve({ data: mensual });
    if (url.includes('/finanzas/resumen')) {
      return Promise.resolve({ data: { totalIngresos: 2295000, cantidadAtenciones: 3 } });
    }
    if (url.includes('/agenda/citas')) return Promise.resolve({ data: [] });
    if (url.includes('/clientes')) return Promise.resolve({ data: [] });
    if (url.includes('/empleadas')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage — resumen mensual (gráficas de 6 meses)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    localStorage.clear();
  });

  it('consulta /finanzas/mensual?meses=6 y renderiza la sección de gráficas', async () => {
    apiConDatos([
      { mes: '2026-07', ingresos: 0, gastos: 0, nomina: 0, ganancia: 0 },
      { mes: '2026-08', ingresos: 2295000, gastos: 350000, nomina: 400000, ganancia: 1545000 },
    ]);

    renderDashboard();

    expect(await screen.findByText('📈 Resumen de los últimos 6 meses')).toBeInTheDocument();

    await waitFor(() => {
      const llamada = mockGet.mock.calls.find(([url]) =>
        (url as string).includes('/finanzas/mensual'),
      );
      expect(llamada).toBeTruthy();
      expect((llamada as unknown[])[1]).toEqual({ params: { meses: 6 } });
    });

    // Los títulos de las tres gráficas se renderizan (el pastel muestra el mes)
    expect(screen.getByText('Ingresos y ganancia por mes')).toBeInTheDocument();
    expect(screen.getByText('Ingresos por mes')).toBeInTheDocument();
    expect(screen.getByText('Distribución del mes: Ago')).toBeInTheDocument();
  });

  it('convierte el mes de la serie a etiqueta corta (2026-08 → Ago) en el título del pastel', async () => {
    apiConDatos([
      { mes: '2026-07', ingresos: 1000000, gastos: 100000, nomina: 200000, ganancia: 700000 },
      { mes: '2026-08', ingresos: 2295000, gastos: 350000, nomina: 400000, ganancia: 1545000 },
    ]);

    renderDashboard();

    // El último mes de la serie (2026-08) se muestra como 'Ago' en el pastel
    expect(await screen.findByText('Distribución del mes: Ago')).toBeInTheDocument();
  });

  it('si el último mes está en ceros, el pastel muestra el mes ANTERIOR con datos (julio)', async () => {
    apiConDatos([
      { mes: '2026-07', ingresos: 1000000, gastos: 0, nomina: 0, ganancia: 1000000 },
      { mes: '2026-08', ingresos: 0, gastos: 0, nomina: 0, ganancia: 0 },
    ]);

    renderDashboard();

    // El pastel NO dice "Sin datos": busca el último mes con movimiento
    expect(await screen.findByText('Distribución del mes: Jul')).toBeInTheDocument();
    expect(screen.queryByText('Sin datos para este mes')).toBeNull();
  });

  it('si el último mes tiene datos, el pastel NO muestra el aviso vacío', async () => {
    apiConDatos([
      { mes: '2026-07', ingresos: 0, gastos: 0, nomina: 0, ganancia: 0 },
      { mes: '2026-08', ingresos: 2295000, gastos: 350000, nomina: 400000, ganancia: 1545000 },
    ]);

    renderDashboard();

    await screen.findByText('📈 Resumen de los últimos 6 meses');
    await waitFor(() => {
      expect(screen.queryByText('Sin datos para este mes')).not.toBeInTheDocument();
    });
  });
});
