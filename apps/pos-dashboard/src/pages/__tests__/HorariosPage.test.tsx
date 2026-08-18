import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';

const { mockGet, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { get: mockGet, put: mockPut },
}));

import HorariosPage from '../HorariosPage';

/** Etiquetas de columna — son el contrato del card view ≤600px (td::before). */
const COL_LABELS = ['Día', 'Abierto', 'Apertura', 'Cierre'];

function horariosApiMock() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/agenda/horarios')) {
      return Promise.resolve({
        data: [
          { diaSemana: 1, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
          { diaSemana: 2, horaApertura: '10:00', horaCierre: '17:00', estaAbierto: false },
        ],
      });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('HorariosPage — contrato responsive y comportamiento (R5)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset();
    horariosApiMock();
  });

  it('muestra las 7 filas de la semana con las 4 columnas etiquetadas con data-label', async () => {
    render(<HorariosPage />);

    // Espera la primera fila de datos (no el estado de carga)
    expect(await screen.findByText('Domingo')).toBeInTheDocument();
    expect(screen.getByText('Sábado')).toBeInTheDocument();

    // 1 fila de header + 7 filas de datos
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(7);

    // Cada celda lleva su data-label (el card view ≤600px los muestra como etiqueta)
    dataRows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      expect(cells).toHaveLength(4);
      cells.forEach((cell, j) => {
        expect(cell).toHaveAttribute('data-label', COL_LABELS[j]);
      });
    });
  });

  it('el switch Abierto refleja el estado y sus inputs de hora siguen el toggle', async () => {
    render(<HorariosPage />);
    await screen.findByText('Domingo');

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(7);

    // Lunes (diaSemana 1) viene abierto → checked; Martes (2) cerrado → unchecked
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();

    // Martes cerrado → sus inputs de hora deshabilitados
    const martesRow = screen.getByText('Martes').closest('tr') as HTMLElement;
    const martesInputs = martesRow.querySelectorAll('input[type="time"]');
    expect(martesInputs).toHaveLength(2);
    expect((martesInputs[0] as HTMLInputElement).disabled).toBe(true);

    // Abrir Martes → los inputs se habilitan
    fireEvent.click(checkboxes[2]);
    expect((martesInputs[0] as HTMLInputElement).disabled).toBe(false);
    expect((martesInputs[1] as HTMLInputElement).disabled).toBe(false);
  });

  it('editar la hora de apertura de un día actualiza el valor del input', async () => {
    render(<HorariosPage />);
    const lunes = await screen.findByText('Lunes');
    const row = lunes.closest('tr') as HTMLElement;

    const apertura = row.querySelectorAll('input[type="time"]')[0] as HTMLInputElement;
    fireEvent.change(apertura, { target: { value: '09:30' } });
    expect(apertura).toHaveValue('09:30');
  });

  it('Guardar cambios hace PUT con los 7 días normalizados y muestra confirmación', async () => {
    mockPut.mockResolvedValue({ data: {} });
    render(<HorariosPage />);
    await screen.findByText('Domingo');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledTimes(1);
    });
    const [, body] = mockPut.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(body).toHaveLength(7);

    // Confirmación visible (mensaje del backend de éxito)
    expect(await screen.findByText('Horarios guardados correctamente')).toBeInTheDocument();
  });

  it('el header de la tabla lista las 4 columnas (Día, Abierto, Apertura, Cierre)', async () => {
    render(<HorariosPage />);
    await screen.findByText('Domingo');

    const headerRow = screen.getAllByRole('row')[0];
    expect(within(headerRow).getByText('Día')).toBeInTheDocument();
    expect(within(headerRow).getByText('Abierto')).toBeInTheDocument();
    expect(within(headerRow).getByText('Apertura')).toBeInTheDocument();
    expect(within(headerRow).getByText('Cierre')).toBeInTheDocument();
  });
});
