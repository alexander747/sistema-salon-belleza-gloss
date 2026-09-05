import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReciboModal, { type ReciboData } from '../ReciboModal';

/** Recibo base: 2 líneas (1 servicio + 1 producto), sin propina/descuento/pendiente. */
function reciboBase(overrides?: Partial<ReciboData>): ReciboData {
  return {
    numero: 42,
    fecha: new Date(2026, 8, 4, 15, 30).toISOString(),
    clienteNombre: 'Ana Cliente',
    empleadaNombre: 'María Empleada',
    lineas: [
      { tipo: 'SERVICIO', nombre: 'Corte', cantidad: 1, precio: 30000, subtotal: 30000 },
      { tipo: 'PRODUCTO', nombre: 'Shampoo', cantidad: 2, precio: 10000, subtotal: 20000 },
    ],
    metodoPago: 'EFECTIVO',
    total: 50000,
    propina: 0,
    descuento: 0,
    montoPendiente: 0,
    ...overrides,
  };
}

function renderRecibo(recibo: ReciboData | null, overrides: { open?: boolean; salon?: { nombre?: string | null } | null } = {}) {
  return render(
    <ReciboModal
      open={overrides.open ?? true}
      recibo={recibo}
      salon={overrides.salon ?? { nombre: 'Gloss Studio' }}
      onClose={() => {}}
    />,
  );
}

describe('ReciboModal — render de datos del recibo', () => {
  it('muestra salón, título "Recibo de venta", Nº, cliente y empleada', () => {
    renderRecibo(reciboBase());

    expect(screen.getByText('Gloss Studio')).toBeInTheDocument();
    expect(screen.getByText('Recibo de venta')).toBeInTheDocument();
    expect(screen.getByText('Nº 42')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Ana Cliente')).toBeInTheDocument();
    expect(screen.getByText('Empleada')).toBeInTheDocument();
    expect(screen.getByText('María Empleada')).toBeInTheDocument();
  });

  it('muestra cada línea con cantidad, precio unitario y subtotal, y el total general', () => {
    renderRecibo(reciboBase());

    // Línea de servicio (cantidad 1: unitario = subtotal)
    const filaCorte = screen.getByText('Corte').closest('tr') as HTMLTableRowElement;
    expect(filaCorte.textContent).toContain('30.000');

    // Línea de producto: cantidad 2 × $ 10.000 → subtotal $ 20.000
    const filaShampoo = screen.getByText('Shampoo').closest('tr') as HTMLTableRowElement;
    expect(filaShampoo.textContent).toContain('2');
    expect(filaShampoo.textContent).toContain('10.000');
    expect(filaShampoo.textContent).toContain('20.000');

    // Fila del total general (50.000)
    const filaTotal = screen.getByText('Total').closest('div') as HTMLDivElement;
    expect(filaTotal.textContent).toContain('50.000');
  });

  it('muestra propina y descuento solo cuando son > 0', () => {
    const { rerender } = renderRecibo(
      reciboBase({ propina: 5000, descuento: 3000, descuentoPorcentaje: 10 }),
    );

    expect(screen.getByText('Propina')).toBeInTheDocument();
    expect(screen.getByText('+$ 5.000')).toBeInTheDocument();
    expect(screen.getByText('Descuento (10%)')).toBeInTheDocument();
    expect(screen.getByText('-$ 3.000')).toBeInTheDocument();

    // Sin propina/descuento → no aparecen filas
    rerender(
      <ReciboModal open recibo={reciboBase()} salon={{ nombre: 'Gloss Studio' }} onClose={() => {}} />,
    );
    expect(screen.queryByText('Propina')).not.toBeInTheDocument();
    expect(screen.queryByText('Descuento (10%)')).not.toBeInTheDocument();
  });

  it('muestra el monto pendiente (fiado) solo cuando es > 0', () => {
    renderRecibo(reciboBase({ montoPendiente: 20000 }));

    const filaPendiente = screen.getByText('Pendiente').closest('div') as HTMLDivElement;
    expect(filaPendiente.textContent).toContain('20.000');
  });

  it('muestra el método de pago con su etiqueta legible', () => {
    renderRecibo(reciboBase({ metodoPago: 'TARJETA' }));

    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
  });

  it('no muestra Nº cuando el recibo no trae número', () => {
    renderRecibo(reciboBase({ numero: null }));

    expect(screen.queryByText(/Nº/)).not.toBeInTheDocument();
  });

  it('renderiza fecha en formato legible', () => {
    renderRecibo(reciboBase());

    const fechaEl = screen.getByTestId('recibo-fecha');
    expect(fechaEl).toHaveTextContent(/2026/);
  });
});

describe('ReciboModal — apertura/cierre', () => {
  it('no renderiza nada cuando open=false', () => {
    renderRecibo(reciboBase(), { open: false });

    expect(screen.queryByText('Recibo de venta')).not.toBeInTheDocument();
  });

  it('no renderiza nada cuando recibo=null', () => {
    renderRecibo(null);

    expect(screen.queryByText('Recibo de venta')).not.toBeInTheDocument();
  });

  it('Cerrar invoca onClose', () => {
    const onClose = vi.fn();
    render(
      <ReciboModal open recibo={reciboBase()} salon={{ nombre: 'Gloss Studio' }} onClose={onClose} />,
    );

    // dentro del dialog del recibo
    const dialog = screen.getByRole('dialog', { name: 'Recibo de venta' });
    const cerrar = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cerrar');
    expect(cerrar).toBeDefined();
    cerrar!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('expone un botón de imprimir', () => {
    renderRecibo(reciboBase());

    const imprimir = screen.getByRole('button', { name: /imprimir/i });
    expect(imprimir).toBeInTheDocument();
  });
});
