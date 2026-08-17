import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet },
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
