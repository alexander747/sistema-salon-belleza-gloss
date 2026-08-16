import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

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
