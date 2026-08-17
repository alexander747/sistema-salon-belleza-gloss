import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost, patch: mockPatch },
}));

import AgendaPage from '../AgendaPage';

/** Listener global para el custom event caja-refresh (banner de caja). */
const refreshSpy = vi.fn();

/** Timeout para waits de RTL: los tests corren en paralelo con toda la suite. */
const WAIT = { timeout: 4000 };

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

/** Cita de hoy a las 10:00 local (dentro de la semana visible del calendario). */
function citaHoy(estado = 'CONFIRMADA'): Record<string, unknown> {
  const fechaHora = new Date(new Date().setHours(10, 0, 0, 0)).toISOString();
  return {
    id: 1,
    salonId: 1,
    fechaHora,
    estado,
    clienteId: 1,
    usuarioId: 1,
    servicios: [{ id: 1, nombre: 'Corte', duracionMinutos: 60, precioBase: 30000, costoBaseInsumos: 0 }],
    creadoEn: new Date().toISOString(),
  };
}

/** Mock genérico: una cita, catálogos mínimos, slot disponible a las 10:00. */
function defaultApiMock(estado = 'CONFIRMADA') {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/agenda/disponibilidad/slots')) {
      return Promise.resolve({ data: [{ hora: '10:00', disponible: true }] });
    }
    if (url.includes('/agenda/citas')) return Promise.resolve({ data: [citaHoy(estado)] });
    if (url.includes('/clientes')) {
      return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', telefono: '123456' }] });
    }
    if (url.includes('/empleadas')) {
      return Promise.resolve({ data: [{ id: 1, nombre: 'Empleada Test', activo: true }] });
    }
    if (url.includes('/servicios')) {
      return Promise.resolve({
        data: [{ id: 1, nombre: 'Corte', duracionMinutos: 60, precioBase: 30000, costoBaseInsumos: 0, activo: true }],
      });
    }
    if (url.includes('/productos')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  });
}

function renderAgenda() {
  return render(
    <MemoryRouter>
      <AgendaPage />
    </MemoryRouter>,
  );
}

/** Llena el modal de nueva cita (cliente + servicio + empleada + fecha + hora). */
async function fillCreateForm(container: HTMLElement) {
  fireEvent.click(await screen.findByRole('button', { name: '+ Nueva Cita' }));

  // El modal arranca con skeleton mientras carga datos de referencia: espera el form
  const clienteInput = (await screen.findByPlaceholderText(/buscar cliente/i, {}, WAIT)) as HTMLInputElement;

  // Cliente: selección POR TECLADO (ArrowDown abre + fetchea, Enter selecciona).
  // Es más robusto que clickear la opción del dropdown: el input es un nodo
  // estable y no hay race con re-renders bajo carga paralela de la suite.
  fireEvent.focus(clienteInput);
  fireEvent.keyDown(clienteInput, { key: 'ArrowDown' });
  await screen.findByRole('option', { name: /cliente test/i }, WAIT);
  fireEvent.keyDown(clienteInput, { key: 'ArrowDown' });
  fireEvent.keyDown(clienteInput, { key: 'Enter' });

  // Gate real: la selección debe persistir (clienteId > 0 muestra el nombre)
  await waitFor(() => {
    expect(clienteInput.value).toBe('Cliente Test');
  }, WAIT);

  // Servicio
  fireEvent.click(await screen.findByRole('checkbox', { name: /corte/i }, WAIT));

  // Empleada: el select del modal es el 2º <select> (el 1º es el filtro del toolbar)
  const selects = container.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: '1' } });

  // Fecha (mañana — el mínimo es hoy)
  const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const fechaISO = `${mañana.getFullYear()}-${String(mañana.getMonth() + 1).padStart(2, '0')}-${String(mañana.getDate()).padStart(2, '0')}`;
  fireEvent.change(container.querySelector('input[type="date"]')!, {
    target: { value: fechaISO },
  });

  // Slot disponible
  fireEvent.click(await screen.findByRole('button', { name: '10:00' }, WAIT));

  // Gate real: el botón Crear cita debe habilitarse (canCreate completo)
  const crearBtn = await screen.findByRole('button', { name: 'Crear cita' });
  await waitFor(() => {
    expect(crearBtn).toBeEnabled();
  }, WAIT);
}

describe('AgendaPage — errores del backend visibles', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    refreshSpy.mockClear();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('B3 — crear cita con conflicto: muestra el mensaje real del backend en el modal', async () => {
    defaultApiMock();
    const conflicto = {
      response: {
        status: 409,
        data: { ok: false, error: { code: 'CONFLICTO', message: 'Conflicto con cita existente' } },
      },
    };
    const { container } = renderAgenda();

    await fillCreateForm(container);

    mockPost.mockRejectedValueOnce(conflicto);
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    expect(await screen.findByText(/Conflicto con cita existente/, {}, WAIT)).toBeInTheDocument();
    // El modal permanece abierto para corregir
    expect(screen.getByRole('button', { name: 'Crear cita' })).toBeInTheDocument();
    // No se cerró el formulario
    expect(screen.getByPlaceholderText(/buscar cliente/i)).toBeInTheDocument();
  }, 20000);

  it('B3 — crear cita OK: cierra el modal y llama al endpoint', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });
    const { container } = renderAgenda();

    await fillCreateForm(container);

    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Crear cita' })).not.toBeInTheDocument();
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/salones/1/agenda/citas',
      expect.objectContaining({ clienteId: 1, serviciosIds: [1], usuarioId: 1 }),
    );
  }, 20000);

  it('B4 — completar cita con error genérico: muestra el mensaje real del backend', async () => {
    defaultApiMock();
    const transicionError = {
      response: {
        status: 422,
        data: {
          ok: false,
          error: { code: 'TRANSICION_INVALIDA', message: 'Transición inválida: de PENDIENTE a COMPLETADA' },
        },
      },
    };
    renderAgenda();

    // Abrir la cita CONFIRMADA y el modal de completar
    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }));

    mockPost.mockRejectedValueOnce(transicionError);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    // El mensaje real del backend aparece (ya no el genérico)
    expect(await screen.findByText(/transición inválida: de pendiente a completada/i, {}, WAIT)).toBeInTheDocument();
    // El modal permanece abierto
    expect(screen.getByRole('button', { name: 'Confirmar y Registrar' })).toBeInTheDocument();
  }, 20000);

  it('B5 — cambiar estado con error: muestra el mensaje real del backend en el modal de detalle', async () => {
    defaultApiMock('PENDIENTE');
    const errorEstado = {
      response: {
        status: 422,
        data: { ok: false, error: { code: 'X', message: 'No se puede confirmar esta cita' } },
      },
    };
    renderAgenda();

    // Abrir la cita PENDIENTE desde el calendario
    fireEvent.click(await screen.findByText('Cliente Test'));

    mockPatch.mockRejectedValueOnce(errorEstado);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText(/No se puede confirmar esta cita/, {}, WAIT)).toBeInTheDocument();
    // El modal de detalle sigue abierto
    expect(screen.getByRole('button', { name: 'Cancelar Cita' })).toBeInTheDocument();
  }, 20000);

  it('B5 — cancelar cita con error: muestra el mensaje real del backend', async () => {
    defaultApiMock('PENDIENTE');
    const errorCancel = {
      response: {
        status: 422,
        data: { ok: false, error: { code: 'X', message: 'La cita ya está cancelada' } },
      },
    };
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar Cita' }));

    fireEvent.change(screen.getByPlaceholderText(/indica el motivo/i), {
      target: { value: 'El cliente no puede asistir' },
    });

    mockPost.mockRejectedValueOnce(errorCancel);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cancelación' }));

    expect(await screen.findByText(/La cita ya está cancelada/, {}, WAIT)).toBeInTheDocument();
  }, 20000);
});
