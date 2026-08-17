import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MoneyInput from '../MoneyInput';

describe('MoneyInput', () => {
  it('muestra el valor formateado con separador de miles', () => {
    render(<MoneyInput value={50000} onChange={() => {}} />);
    expect(screen.getByDisplayValue('50.000')).toBeInTheDocument();
  });

  it('muestra vacío cuando value es 0', () => {
    render(<MoneyInput value={0} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('llama onChange con el número cuando el usuario escribe dígitos', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={0} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '50000' } });

    expect(onChange).toHaveBeenCalledWith(50000);
  });

  it('formatea el display en vivo mientras se escribe', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={0} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1200000' } });

    expect(screen.getByDisplayValue('1.200.000')).toBeInTheDocument();
  });

  it('descarta caracteres no numéricos', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={0} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12a3.0' } });

    expect(onChange).toHaveBeenCalledWith(1230);
  });

  it('llama onChange con 0 al vaciar el campo', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={50000} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('sincroniza el display cuando value cambia desde afuera', () => {
    const { rerender } = render(<MoneyInput value={50000} onChange={() => {}} />);
    expect(screen.getByDisplayValue('50.000')).toBeInTheDocument();

    rerender(<MoneyInput value={750000} onChange={() => {}} />);

    expect(screen.getByDisplayValue('750.000')).toBeInTheDocument();
  });

  it('respeta placeholder, ariaLabel y disabled', () => {
    render(
      <MoneyInput
        value={0}
        onChange={() => {}}
        placeholder="0"
        ariaLabel="Monto inicial"
        disabled
      />,
    );

    const input = screen.getByLabelText('Monto inicial');
    expect(input).toHaveAttribute('placeholder', '0');
    expect(input).toBeDisabled();
  });
});
