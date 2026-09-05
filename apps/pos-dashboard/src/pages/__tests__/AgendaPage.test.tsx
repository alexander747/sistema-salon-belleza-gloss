import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/** Fecha en formato yyyy-mm-dd local (mismo helper que AgendaPage). */
function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha pasada fija (relativa a hoy) para probar backfill sin depender del reloj. */
function fechaPasada(): string {
  const pasada = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return toISODateLocal(pasada);
}

/** Llena el modal de nueva cita (cliente + servicio + empleada + fecha + hora). */
async function fillCreateForm(container: HTMLElement, fechaISO?: string) {
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

  // Fecha (default: mañana; caller puede pasar una fecha pasada)
  const fecha = fechaISO ?? toISODateLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
  fireEvent.change(container.querySelector('input[type="date"]')!, {
    target: { value: fecha },
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
    }, WAIT);
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

describe('AgendaPage — gating de botones por estado (B6)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('PENDIENTE → Confirmar + Cancelar, NUNCA Completar ni No llegó', async () => {
    defaultApiMock('PENDIENTE');
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    await screen.findByRole('button', { name: 'Confirmar' }, WAIT);

    expect(screen.getByRole('button', { name: 'Cancelar Cita' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No llegó' })).not.toBeInTheDocument();
  }, 20000);

  it('CONFIRMADA → Completar + No llegó + Cancelar', async () => {
    defaultApiMock('CONFIRMADA');
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    await screen.findByRole('button', { name: 'Completar' }, WAIT);

    expect(screen.getByRole('button', { name: 'No llegó' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar Cita' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  }, 20000);

  it('No llegó en CONFIRMADA → PATCH estado NO_LLEGO y cierra el modal', async () => {
    defaultApiMock('CONFIRMADA');
    mockPatch.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'No llegó' }, WAIT));

    expect(mockPatch).toHaveBeenCalledWith('/salones/1/agenda/citas/1/estado', {
      estado: 'NO_LLEGO',
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'No llegó' })).not.toBeInTheDocument();
    });
  }, 20000);

  it('COMPLETADA (terminal) → sin botones de acción', async () => {
    defaultApiMock('COMPLETADA');
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    await screen.findByText(/Cita #1/, {}, WAIT);

    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar Cita' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No llegó' })).not.toBeInTheDocument();
  }, 20000);
});

describe('AgendaPage — quick-add cliente en el modal de nueva cita (C3)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('crear cliente desde el modal: POST al endpoint y refetch de clientes (sin ReferenceError de setClientes)', async () => {
    defaultApiMock();
    mockPost.mockImplementation((url: string) => {
      if (String(url).includes('/clientes')) {
        return Promise.resolve({ data: { id: 99, nombre: 'Nuevo Cliente', telefono: '3001112233' } });
      }
      return Promise.resolve({ data: {} });
    });

    renderAgenda();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nueva Cita' }, WAIT));

    // Abrir el dropdown del buscador de clientes para ver "+ Crear nuevo cliente"
    const clienteInput = await screen.findByPlaceholderText(/buscar cliente/i, {}, WAIT);
    fireEvent.focus(clienteInput);
    fireEvent.keyDown(clienteInput, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('button', { name: '+ Crear nuevo cliente' }, WAIT));

    // Llenar el mini-modal
    fireEvent.change(await screen.findByPlaceholderText('Nombre del cliente', {}, WAIT), {
      target: { value: 'Nuevo Cliente' },
    });
    fireEvent.change(screen.getByPlaceholderText('Número de teléfono'), {
      target: { value: '3001112233' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));

    // El POST de creación viaja con nombre y teléfono
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/clientes',
        expect.objectContaining({ nombre: 'Nuevo Cliente', telefono: '3001112233' }),
      );
    }, WAIT);

    // REGRESIÓN C3: tras crear el cliente el padre hace REFETCH de clientes
    // (antes, refreshClientes usaba setClientes indefinido → ReferenceError y
    // el dropdown nunca se refrescaba). El refetch dispara un NUEVO GET /clientes.
    const clientesGets = () =>
      mockGet.mock.calls.filter(([url]) => String(url).includes('/clientes'));
    const antes = clientesGets().length;
    await waitFor(() => {
      expect(clientesGets().length).toBeGreaterThan(antes);
    }, WAIT);

    // El mini-modal se cierra (no queda abierto con error) — espera el re-render
    await waitFor(() => {
      expect(screen.queryByText('Crear nuevo cliente')).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);
});

describe('AgendaPage — happy paths de cita (D6)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('confirmar cita PENDIENTE → PATCH estado CONFIRMADA y cierra el modal', async () => {
    defaultApiMock('PENDIENTE');
    mockPatch.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }, WAIT));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/salones/1/agenda/citas/1/estado', {
        estado: 'CONFIRMADA',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);

  it('completar cita CONFIRMADA → POST atómico /completar con registro anidado', async () => {
    defaultApiMock('CONFIRMADA');
    mockPost.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    await waitFor(() => {
      // UNA sola llamada: el registro viaja anidado en el POST /completar (transacción atómica)
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/agenda/citas/1/completar',
        expect.objectContaining({
          registro: expect.objectContaining({
            salonId: 1,
            clienteId: 1,
            usuarioId: 1,
            totalServicios: 30000,
            totalProductos: 0,
            montoTotal: 30000,
            pagos: [{ monto: 30000, metodoPago: 'EFECTIVO' }],
            serviciosIds: [1],
            serviciosItems: [
              expect.objectContaining({
                servicioId: 1,
                nombreServicio: 'Corte',
                precioServicio: 30000,
              }),
            ],
          }),
        }),
      );
    });
    // No hay POST separado a /registros: el flujo es atómico
    expect(mockPost.mock.calls.some(([url]) => String(url).includes('/registros'))).toBe(false);
    // El modal de completar se cierra
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirmar y Registrar' })).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);

  it('completar cita con TARJETA → el pago viaja con metodoPago TARJETA', async () => {
    defaultApiMock('CONFIRMADA');
    mockPost.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));

    // Cambiar el método de pago por defecto (EFECTIVO) a TARJETA
    fireEvent.click(await screen.findByRole('button', { name: 'Tarjeta' }, WAIT));

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    await waitFor(() => {
      const completarCall = mockPost.mock.calls.find(([url]) =>
        String(url).includes('/completar'),
      );
      expect(completarCall).toBeDefined();
      const [, body] = completarCall as [string, { registro: { pagos: Array<{ metodoPago: string }>; montoTotal: number } }];
      expect(body.registro.pagos).toEqual([{ monto: 30000, metodoPago: 'TARJETA' }]);
      expect(body.registro.montoTotal).toBe(30000);
    });
  }, 20000);

  it('completar cita con EFECTIVO: monto recibido muestra vuelto y el pago viaja con EFECTIVO', async () => {
    defaultApiMock('CONFIRMADA');
    mockPost.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));

    // EFECTIVO es el default: el input de monto recibido tiene como placeholder el total
    const montoRecibido = screen.getByPlaceholderText(/\$\s*30\.000/);
    fireEvent.change(montoRecibido, { target: { value: '50000' } });

    // Vuelto visible: 50.000 - 30.000 = 20.000
    expect(await screen.findByText('Vuelto')).toBeInTheDocument();
    expect(screen.getAllByText('$ 20.000').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    await waitFor(() => {
      const completarCall = mockPost.mock.calls.find(([url]) =>
        String(url).includes('/completar'),
      );
      expect(completarCall).toBeDefined();
      const [, body] = completarCall as [string, { registro: { pagos: Array<{ monto: number; metodoPago: string }> } }];
      // El monto del pago es el total final (30.000), no el monto recibido
      expect(body.registro.pagos).toEqual([{ monto: 30000, metodoPago: 'EFECTIVO' }]);
    });
  }, 20000);

  it('ajuste de total: exige nota obligatoria y el registro viaja con precioAjustado', async () => {
    defaultApiMock('CONFIRMADA');
    mockPost.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));

    // Activar el ajuste de total
    fireEvent.click(await screen.findByLabelText('Ajustar valor total', {}, WAIT));

    // Input del total personalizado: placeholder = total calculado ($ 30.000)
    const totalInputs = screen.getAllByPlaceholderText(/\$\s*30\.000/);
    fireEvent.change(totalInputs[0], { target: { value: '25000' } });

    // Ajuste sin nota → error visible y botón deshabilitado
    expect(
      await screen.findByText(/Este campo es obligatorio cuando hay descuento o ajuste de total/i, {}, WAIT),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar y Registrar' })).toBeDisabled();

    // Con la nota, el botón se habilita
    fireEvent.change(screen.getByPlaceholderText(/Indicá el motivo del ajuste/i), {
      target: { value: 'Descuento por cliente frecuente' },
    });
    expect(screen.getByRole('button', { name: 'Confirmar y Registrar' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    await waitFor(() => {
      const completarCall = mockPost.mock.calls.find(([url]) =>
        String(url).includes('/completar'),
      );
      expect(completarCall).toBeDefined();
      const [, body] = completarCall as [string, { registro: { montoTotal: number; precioAjustado: boolean; valorOriginal: number; valorFinal: number; notas: string } }];
      expect(body.registro.montoTotal).toBe(25000);
      expect(body.registro.precioAjustado).toBe(true);
      expect(body.registro.valorOriginal).toBe(30000);
      expect(body.registro.valorFinal).toBe(25000);
      expect(body.registro.notas).toContain('[AJUSTE: total $25000]');
    });
  }, 20000);

  it('navegación semanal: Siguiente → 7 días, Anterior → vuelve a la semana original', async () => {
    defaultApiMock('CONFIRMADA');
    renderAgenda();

    // Esperar el calendario y la primera consulta de citas
    await screen.findByLabelText('Semana anterior');
    await waitFor(() => {
      expect(mockGet.mock.calls.some(([url]) => String(url).includes('/agenda/citas'))).toBe(true);
    }, WAIT);

    const getUltimaCitasCall = () => {
      const calls = mockGet.mock.calls.filter(([url]) => String(url).includes('/agenda/citas'));
      return calls[calls.length - 1];
    };
    const getDesde = () => new Date(getUltimaCitasCall()?.[1].params.desde as string).getTime();
    const semanaOriginal = getDesde();

    fireEvent.click(screen.getByLabelText('Semana siguiente'));

    await waitFor(() => {
      expect(getDesde()).toBe(semanaOriginal + 7 * 24 * 3600 * 1000);
    }, WAIT);

    fireEvent.click(screen.getByLabelText('Semana anterior'));

    await waitFor(() => {
      expect(getDesde()).toBe(semanaOriginal);
    }, WAIT);
  }, 20000);
});

describe('AgendaPage — fechas backfill (PR3)', () => {
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

  it('la fecha del modal arranca en hoy y NO tiene min (backfill de fechas pasadas)', async () => {
    defaultApiMock();
    const { container } = renderAgenda();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nueva Cita' }, WAIT));
    await screen.findByPlaceholderText(/buscar cliente/i, {}, WAIT);

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    expect(dateInput.hasAttribute('min')).toBe(false);
    expect(dateInput.value).toBe(toISODateLocal(new Date()));
  }, 20000);

  it('permite crear una cita con fecha pasada (fechaHora = fecha pasada T10:00 local)', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });
    const { container } = renderAgenda();

    await fillCreateForm(container, fechaPasada());

    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/salones/1/agenda/citas',
        expect.objectContaining({
          fechaHora: new Date(`${fechaPasada()}T10:00:00`).toISOString(),
        }),
      );
    }, WAIT);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Crear cita' })).not.toBeInTheDocument();
    }, WAIT);
  }, 20000);
});

describe('AgendaPage — modales bottom-sheet en móvil (R5/D10)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('el modal de nueva cita: overlay y panel con las clases bottom-sheet', async () => {
    defaultApiMock();
    renderAgenda();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nueva Cita' }, WAIT));

    // Anclarse al título (solo existe en este modal) y subir por ancestros:
    // evita races con modales en exit de AnimatePresence.
    const titulo = await screen.findByText('Nueva Cita', {}, WAIT);
    expect(titulo.closest('.mobileBottomSheet')).not.toBeNull();
    expect(titulo.closest('.mobileBottomSheetContent')).not.toBeNull();
  }, 20000);

  it('el modal de detalle: overlay y panel con las clases bottom-sheet', async () => {
    defaultApiMock('CONFIRMADA');
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));

    const titulo = await screen.findByText(/Cita #1/, {}, WAIT);
    expect(titulo.closest('.mobileBottomSheet')).not.toBeNull();
    expect(titulo.closest('.mobileBottomSheetContent')).not.toBeNull();
  }, 20000);

  it('el modal de completar: overlay y panel con las clases bottom-sheet', async () => {
    defaultApiMock('CONFIRMADA');
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));

    const titulo = await screen.findByText(/Completar Cita #1/, {}, WAIT);
    expect(titulo.closest('.mobileBottomSheet')).not.toBeNull();
    expect(titulo.closest('.mobileBottomSheetContent')).not.toBeNull();
  }, 20000);
});

describe('AgendaPage — MQ móvil del module.css (R5/D9)', () => {
  const agendaCss = readFileSync(
    join(process.cwd(), 'src/pages/AgendaPage.module.css'),
    'utf-8',
  );

  it('≤600px: los controles del modal de completar suben a touch targets (44px / qty 40px)', () => {
    const mqIndex = agendaCss.indexOf('@media (max-width: 600px)');
    expect(mqIndex).toBeGreaterThan(-1);
    const nextMq = agendaCss.indexOf('@media', mqIndex + 1);
    const mobileBlock =
      nextMq === -1 ? agendaCss.slice(mqIndex) : agendaCss.slice(mqIndex, nextMq);

    // Controles bespoke del modal de completar (no cubiertos por la regla
    // global de .formInput/.formSelect/.formTextarea) suben a 44px.
    expect(mobileBlock).toContain('.servicePriceInput');
    expect(mobileBlock).toContain('.paymentBtn');
    expect(mobileBlock).toContain('min-height: 44px');
    // Los steppers de cantidad del carrito de productos ≥40px
    expect(mobileBlock).toMatch(/\.qtyBtn\s*\{[^}]*40px/s);
  });
});

describe('AgendaPage — fiado y pago parcial al completar cita (PR3)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  /** Cita de 100.000 (servicio "Corte Premium") para probar parciales. */
  function citaHoy100k(): Record<string, unknown> {
    const fechaHora = new Date(new Date().setHours(10, 0, 0, 0)).toISOString();
    return {
      id: 1,
      salonId: 1,
      fechaHora,
      estado: 'CONFIRMADA',
      clienteId: 1,
      usuarioId: 1,
      servicios: [{ id: 1, nombre: 'Corte Premium', duracionMinutos: 60, precioBase: 100000, costoBaseInsumos: 0 }],
      creadoEn: new Date().toISOString(),
    };
  }

  function apiMock100k() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/agenda/disponibilidad/slots')) {
        return Promise.resolve({ data: [{ hora: '10:00', disponible: true }] });
      }
      if (url.includes('/agenda/citas')) return Promise.resolve({ data: [citaHoy100k()] });
      if (url.includes('/clientes')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Cliente Test', telefono: '123456' }] });
      }
      if (url.includes('/empleadas')) {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Empleada Test', activo: true }] });
      }
      if (url.includes('/servicios')) {
        return Promise.resolve({
          data: [{ id: 1, nombre: 'Corte Premium', duracionMinutos: 60, precioBase: 100000, costoBaseInsumos: 0, activo: true }],
        });
      }
      if (url.includes('/productos')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
  }

  /** Abre el modal de completar y devuelve el último POST /completar. */
  function ultimoCompletarCall() {
    const calls = mockPost.mock.calls.filter(([url]) => String(url).includes('/completar'));
    const call = calls[calls.length - 1];
    return call as [string, { registro: { pagos: Array<{ monto: number; metodoPago: string }> } }];
  }

  it('fiado total: toggle ON → pagos [{monto:0}] y muestra pendiente completo', async () => {
    apiMock100k();
    mockPost.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));

    fireEvent.click(screen.getByLabelText(/fiado/i));

    // Total 100.000 − propina 0 − pago 0 → queda pendiente 100.000
    expect(await screen.findByText(/Queda pendiente: \$\s*100\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    await waitFor(() => {
      expect(ultimoCompletarCall()[1].registro.pagos).toEqual([{ monto: 0, metodoPago: 'EFECTIVO' }]);
    }, WAIT);
  }, 20000);

  it('pago parcial: monto 60.000 de total 100.000 → pagos [{monto:60000}] y pendiente 40.000', async () => {
    apiMock100k();
    mockPost.mockResolvedValue({ data: {} });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));

    fireEvent.click(screen.getByLabelText(/fiado/i));
    fireEvent.change(screen.getByLabelText('Monto a cobrar'), { target: { value: '60000' } });

    expect(await screen.findByText(/Queda pendiente: \$\s*40\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    await waitFor(() => {
      expect(ultimoCompletarCall()[1].registro.pagos).toEqual([{ monto: 60000, metodoPago: 'EFECTIVO' }]);
    }, WAIT);
  }, 20000);
});

describe('AgendaPage — escáner de código de barras al completar (PR2)', () => {
  const productoBarra = {
    id: 2,
    nombre: 'Shampoo Barra',
    marca: null,
    precioVenta: 15000,
    cantidadStock: 5,
    codigoBarras: '7701234567890',
  };

  function apiMockConProductos() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/agenda/citas')) return Promise.resolve({ data: [citaHoy('CONFIRMADA')] });
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
      if (url.includes('/productos')) return Promise.resolve({ data: [productoBarra] });
      return Promise.resolve({ data: {} });
    });
  }

  /** Abre el modal de completar de la cita CONFIRMADA. */
  async function abrirCompletar() {
    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));
  }

  function scanear(codigo: string) {
    const scan = screen.getByPlaceholderText(/escanear código/i);
    fireEvent.change(scan, { target: { value: codigo } });
    fireEvent.keyDown(scan, { key: 'Enter' });
    return scan as HTMLInputElement;
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('escanear un código existente agrega el producto al carrito del modal', async () => {
    apiMockConProductos();
    renderAgenda();
    await abrirCompletar();

    const scan = scanear('7701234567890');

    // El producto aparece en "En carrito" (además de su card en el catálogo)
    expect(await screen.findByText(/En carrito \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Shampoo Barra').length).toBeGreaterThanOrEqual(2);
    expect(scan.value).toBe('');
  });

  it('código desconocido muestra "Producto no encontrado"', async () => {
    apiMockConProductos();
    renderAgenda();
    await abrirCompletar();

    scanear('000000');

    expect(await screen.findByText(/Producto no encontrado/)).toBeInTheDocument();
  });
});

describe('AgendaPage — recibo tras completar cita (PR2)', () => {
  function apiMockRecibo() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
      if (url.includes('/agenda/citas')) return Promise.resolve({ data: [citaHoy('CONFIRMADA')] });
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

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    window.addEventListener('caja-refresh', refreshSpy as EventListener);
  });

  afterEach(() => {
    window.removeEventListener('caja-refresh', refreshSpy as EventListener);
  });

  it('tras completar muestra el ReciboModal con cliente, servicio, total y Nº del registro', async () => {
    apiMockRecibo();
    mockPost.mockResolvedValue({
      data: { cita: { id: 1 }, registro: { id: 77, fechaHora: '2026-09-04T12:00:00.000Z' } },
    });
    renderAgenda();

    fireEvent.click(await screen.findByText('Cliente Test'));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }, WAIT));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Registrar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Recibo de venta' });
    expect(within(dialog).getByText('Recibo de venta')).toBeInTheDocument();
    expect(within(dialog).getByText('Cliente Test')).toBeInTheDocument();
    expect(within(dialog).getByText('Empleada Test')).toBeInTheDocument();
    expect(within(dialog).getByText('Corte')).toBeInTheDocument();
    expect(within(dialog).getByText('Nº 77')).toBeInTheDocument();

    // El modal de completar quedó cerrado
    expect(screen.queryByRole('button', { name: 'Confirmar y Registrar' })).not.toBeInTheDocument();
  });
});
