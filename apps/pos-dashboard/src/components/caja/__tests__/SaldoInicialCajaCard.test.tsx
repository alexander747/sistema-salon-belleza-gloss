import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Rol, type IUser } from '@pos-final/types';

const { mockGet, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('../../../services/api.js', () => ({
  default: { get: mockGet, put: mockPut },
}));

import SaldoInicialCajaCard from '../SaldoInicialCajaCard';

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

const administrador: IUser = { ...duena, id: 3, rol: Rol.ADMINISTRADOR };
const manicurista: IUser = { ...duena, id: 4, rol: Rol.MANICURISTA };

const saldoResponse = (saldoInicialCaja: number, posicionCaja: number) => ({
  data: { ok: true, data: { saldoInicialCaja, posicionCaja } },
});

describe('SaldoInicialCajaCard', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset();
  });

  it('DUEÑA: muestra la posición de caja y el saldo inicial desde el API', async () => {
    mockGet.mockResolvedValue(saldoResponse(100000, 250000));

    render(<SaldoInicialCajaCard salonId={1} user={duena} />);

    expect(mockGet).toHaveBeenCalledWith('/salones/1/caja/saldo-inicial');
    expect(await screen.findByTestId('posicion-caja-valor')).toHaveTextContent(/250\.000/);
    expect(screen.getByTestId('saldo-inicial-valor')).toHaveTextContent(/100\.000/);
  });

  it('muestra el HelpTip del saldo inicial con la explicación exacta (punto de partida, NO ganancia)', async () => {
    mockGet.mockResolvedValue(saldoResponse(100000, 250000));

    render(<SaldoInicialCajaCard salonId={1} user={duena} />);
    await screen.findByTestId('posicion-caja-valor');

    const info = screen.getByRole('button', { name: 'Qué significa Saldo inicial de caja' });
    fireEvent.click(info);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent(
      'Plata que el negocio ya tenía antes de usar el sistema. Es el punto de partida, NO es ganancia.',
    );

    // La posición también explica que es informativa y que no es ganancia.
    expect(
      screen.getByRole('button', { name: 'Qué significa Posición de caja' }),
    ).toBeInTheDocument();
  });

  it('DUEÑA: edita el saldo inicial → PUT y refresca la caja (custom event)', async () => {
    mockGet.mockResolvedValue(saldoResponse(100000, 250000));
    mockPut.mockResolvedValue(saldoResponse(500000, 650000));
    const spy = vi.spyOn(window, 'dispatchEvent');

    render(<SaldoInicialCajaCard salonId={1} user={duena} />);
    await screen.findByTestId('saldo-inicial-valor');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const input = await screen.findByLabelText('Saldo inicial de caja');
    fireEvent.change(input, { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/salones/1/caja/saldo-inicial', {
        saldoInicialCaja: 500000,
      });
    });
    expect(await screen.findByTestId('saldo-inicial-valor')).toHaveTextContent(/500\.000/);
    expect(screen.getByTestId('posicion-caja-valor')).toHaveTextContent(/650\.000/);
    expect(await screen.findByText(/saldo inicial actualizado/i)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'caja-refresh' }));
  });

  it('ADMINISTRADOR: ve la tarjeta pero NO puede editar (sin botón Editar)', async () => {
    mockGet.mockResolvedValue(saldoResponse(100000, 250000));

    render(<SaldoInicialCajaCard salonId={1} user={administrador} />);
    await screen.findByTestId('posicion-caja-valor');

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getByTestId('saldo-inicial-valor')).toBeInTheDocument();
  });

  it('MANICURISTA: no renderiza nada ni consulta el API', async () => {
    const { container } = render(<SaldoInicialCajaCard salonId={1} user={manicurista} />);

    await waitFor(() => expect(mockGet).not.toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Posición de caja/i)).not.toBeInTheDocument();
  });

  it('sin datos válidos del API no fabrica un $0 (no muestra la tarjeta)', async () => {
    mockGet.mockResolvedValue({ data: {} });

    const { container } = render(<SaldoInicialCajaCard salonId={1} user={duena} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
