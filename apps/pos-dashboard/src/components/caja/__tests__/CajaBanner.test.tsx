import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost },
}));

import CajaBanner, { getColombiaDateString } from '../CajaBanner';

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
  rol: Rol.MANICURISTA,
};

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

const error404 = {
  response: {
    status: 404,
    data: { ok: false, error: { code: 'CAJA_NO_ABIERTA', message: 'No hay caja abierta' } },
  },
};

function renderBanner(user: IUser | null, onNav = vi.fn()) {
  return render(
    <MemoryRouter>
      <CajaBanner salonId={1} user={user} onNavigateToCaja={onNav} />
    </MemoryRouter>,
  );
}

describe('CajaBanner', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('muestra banner verde "Caja abierta" con el monto inicial cuando GET /caja/actual responde ABIERTA', async () => {
    mockGet.mockResolvedValue({ data: { ok: true, data: cajaAbierta } });

    renderBanner(duena);

    expect(await screen.findByText(/Caja abierta/)).toBeInTheDocument();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/actual');
  });

  it('muestra banner ámbar "Caja cerrada — Abrir para vender" cuando la API responde 404 CAJA_NO_ABIERTA', async () => {
    mockGet.mockRejectedValue(error404);

    renderBanner(duena);

    expect(await screen.findByText(/Caja cerrada/)).toBeInTheDocument();
    expect(screen.getByText(/Abrir para vender/)).toBeInTheDocument();
  });

  it('muestra "Reabrir para vender" y botón "Reabrir" cuando la caja de HOY está cerrada (historial trae CERRADA de hoy)', async () => {
    // GET /caja/actual → 404; GET cajas ABIERTA → sin huérfanas; GET /caja/cierres → caja de HOY CERRADA
    const hoy = getColombiaDateString();
    mockGet
      .mockRejectedValueOnce(error404)
      .mockResolvedValueOnce({
        data: {
          ok: true,
          data: { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } },
        },
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          data: {
            data: [
              {
                id: 5,
                salonId: 1,
                fechaCaja: hoy,
                montoInicial: 50000,
                montoEsperado: 60000,
                montoRealEfectivo: 60000,
                diferencia: 0,
                estado: 'CERRADA',
                aperturaPorId: 2,
                aperturaEn: '2026-08-16T13:00:00.000Z',
                cierrePorId: 2,
                cierreEn: '2026-08-16T18:00:00.000Z',
                creadoEn: '2026-08-16T13:00:00.000Z',
              },
            ],
            meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
          },
        },
      });

    renderBanner(duena);

    expect(await screen.findByText(/Reabrir para vender/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
    // Sin huérfanas → consulta el historial de cierres para decidir "Reabrir"
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/cierres?estado=ABIERTA&limit=0');
    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/cierres?page=1&limit=1');
  });

  it('muestra el botón Abrir/Cerrar solo para roles con permiso (DUEÑA sí, MANICURISTA no)', async () => {
    mockGet.mockRejectedValue(error404);
    renderBanner(manicurista);

    expect(await screen.findByText(/Caja cerrada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
  });

  it('muestra botón "Cerrar" cuando hay caja abierta y el rol tiene permiso', async () => {
    mockGet.mockResolvedValue({ data: { ok: true, data: cajaAbierta } });

    renderBanner(duena);

    expect(await screen.findByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('refetches al recibir el custom event "caja-refresh"', async () => {
    mockGet.mockResolvedValue({ data: { ok: true, data: cajaAbierta } });

    renderBanner(duena);
    await screen.findByText(/Caja abierta/);
    expect(mockGet).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('caja-refresh'));

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it('llama a onNavigateToCaja al hacer clic en "Abrir"', async () => {
    mockGet.mockRejectedValue(error404);
    const onNav = vi.fn();

    renderBanner(duena, onNav);

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    expect(onNav).toHaveBeenCalled();
  });

  it('muestra "Ver caja" (no "Abrir") con el count de pendientes cuando hay una huérfana ABIERTA', async () => {
    mockGet
      .mockRejectedValueOnce(error404)
      .mockResolvedValueOnce({
        data: {
          ok: true,
          data: { data: [cajaAbierta], meta: { page: 1, limit: 0, total: 1, totalPages: 1 } },
        },
      });

    renderBanner(duena);

    expect(await screen.findByText(/pendiente[s]? de cierre/i)).toBeInTheDocument();
    expect(screen.getByText(/hay 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver caja' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('navega al tab Caja al hacer clic en "Ver caja" con huérfanas', async () => {
    mockGet
      .mockRejectedValueOnce(error404)
      .mockResolvedValueOnce({
        data: {
          ok: true,
          data: { data: [cajaAbierta], meta: { page: 1, limit: 0, total: 1, totalPages: 1 } },
        },
      });
    const onNav = vi.fn();

    renderBanner(duena, onNav);

    fireEvent.click(await screen.findByRole('button', { name: 'Ver caja' }));
    expect(onNav).toHaveBeenCalled();
  });
});
