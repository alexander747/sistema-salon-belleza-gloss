import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../services/api.js', () => ({
  default: { get: mockGet },
}));

import App from '../App';

const manicurista: IUser = {
  id: 4,
  nombre: 'Mani Test',
  numeroWhatsApp: '',
  email: 'mani@test.com',
  rol: Rol.MANICURISTA,
  salonId: 1,
  porcentajeComisionServicio: 0,
  sueldoFijo: 0,
  bonoHorario: 0,
  activo: true,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const duena: IUser = {
  ...manicurista,
  id: 2,
  nombre: 'Dueña Test',
  email: 'duena@test.com',
  rol: Rol.DUEÑA,
};

/** Mock: /auth/me devuelve el usuario; el resto responde vacío. */
function apiMock(user: IUser) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: user });
    if (url.includes('/finanzas/resumen')) {
      return Promise.resolve({ data: { totalIngresos: 0, totalServicios: 0, totalProductos: 0 } });
    }
    if (url.includes('/clientes')) return Promise.resolve({ data: { data: [] } });
    if (url.includes('/empleadas')) return Promise.resolve({ data: { data: [] } });
    if (url.includes('/citas')) return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: {} });
  });
}

describe('App — route guard por rol', () => {
  beforeEach(() => {
    mockGet.mockReset();
    // ProtectedRoute exige el token para dejar pasar (App completa, no página aislada)
    localStorage.setItem('accessToken', 'test-token');
  });

  afterEach(() => {
    localStorage.removeItem('accessToken');
    window.history.replaceState({}, '', '/');
  });

  it('MANICURISTA en /finanzas (permitida) NO es redirigida: ve el tab Registros', async () => {
    window.history.pushState({}, '', '/finanzas');
    apiMock(manicurista);

    render(<App />);

    // Finanzas es ahora su landing: monta la página y su tab de Registros
    expect(await screen.findByText('📋 Registros', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByText('Finanzas').length).toBeGreaterThanOrEqual(1);
    // No se renderiza el Dashboard
    expect(screen.queryByText('Tu salón está listo')).not.toBeInTheDocument();
  }, 15000);

  it('MANICURISTA en / es redirigida a /finanzas (no ve el Dashboard)', async () => {
    window.history.pushState({}, '', '/');
    apiMock(manicurista);

    render(<App />);

    // El guard reemplaza la ruta raíz por el landing del rol
    expect(await screen.findByText('📋 Registros', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText('Tu salón está listo')).not.toBeInTheDocument();
  }, 15000);

  it('MANICURISTA en /clientes (permitida) NO es redirigida: ve el sidebar filtrado', async () => {
    window.history.pushState({}, '', '/clientes');
    apiMock(manicurista);

    render(<App />);

    // La página de clientes carga su propio /auth/me y lista (vacía → estado vacío)
    expect(await screen.findByText('No hay clientes registrados', {}, { timeout: 5000 })).toBeInTheDocument();
    // El sidebar está filtrado: con Finanzas/Servicios, sin Ventas ni Dashboard ni Horarios
    expect(screen.getAllByText('Finanzas').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Ventas')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Horarios')).not.toBeInTheDocument();
    expect(screen.getAllByText('Servicios').length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it('DUEÑA en /finanzas: la página se monta (rol con permiso completo)', async () => {
    window.history.pushState({}, '', '/finanzas');
    apiMock(duena);

    render(<App />);

    expect(await screen.findByText('📋 Registros', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByText('Finanzas').length).toBeGreaterThanOrEqual(1);
  }, 15000);
});
