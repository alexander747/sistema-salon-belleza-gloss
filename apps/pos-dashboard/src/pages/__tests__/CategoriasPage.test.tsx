import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut },
}));

import CategoriasPage from '../CategoriasPage';

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

function defaultApiMock(categorias: unknown[] = []) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/auth/me')) return Promise.resolve({ data: duena });
    if (url.includes('/categorias')) return Promise.resolve({ data: categorias });
    if (url.includes('/servicios')) return Promise.resolve({ data: [] });
    if (url.includes('/productos')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/categorias']}>
      <CategoriasPage />
    </MemoryRouter>,
  );
}

const WAIT = { timeout: 4000 };

describe('CategoriasPage — create/edit con modal (estandarizado)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
  });

  it('botón "+ Nueva Categoría" abre el modal y Crear hace POST', async () => {
    defaultApiMock();
    mockPost.mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Nueva Categoría' }));

    expect(await screen.findByText('Nueva Categoría', {}, WAIT)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ej: Cortes'), {
      target: { value: 'Cortes' },
    });
    fireEvent.change(screen.getByPlaceholderText('Opcional'), {
      target: { value: 'Servicios de corte' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/salones/1/categorias', {
        nombre: 'Cortes',
        descripcion: 'Servicios de corte',
      });
    });
    // El modal se cierra tras crear
    await waitFor(() => {
      expect(screen.queryByText('Nueva Categoría')).not.toBeInTheDocument();
    });
  }, 20000);

  it('Editar abre el modal precargado y Guardar hace PUT', async () => {
    defaultApiMock([
      { id: 1, nombre: 'Cortes', descripcion: 'Vieja desc', creadoEn: '2026-01-01', actualizadoEn: '2026-01-01' },
    ]);
    mockPut.mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, WAIT));

    expect(await screen.findByText('Editar Categoría', {}, WAIT)).toBeInTheDocument();
    const nombreInput = screen.getByDisplayValue('Cortes');
    fireEvent.change(nombreInput, { target: { value: 'Cortes Premium' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/salones/1/categorias/1', {
        nombre: 'Cortes Premium',
        descripcion: 'Vieja desc',
      });
    });
  }, 20000);

  it('la fila mantiene los botones de acción Editar y Eliminar', async () => {
    defaultApiMock([
      { id: 1, nombre: 'Cortes', descripcion: '', creadoEn: '2026-01-01', actualizadoEn: '2026-01-01' },
    ]);
    renderPage();

    expect(await screen.findByText('Cortes', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  }, 20000);
});
