import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaginationBar from '../PaginationBar';

describe('PaginationBar', () => {
  it('no renderiza nada cuando hay una sola página', () => {
    const { container } = render(
      <PaginationBar page={1} totalPages={1} total={5} label="registros" onPrev={vi.fn()} onNext={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('muestra "Página X de Y (Z label)" con los botones Anterior/Siguiente', () => {
    render(
      <PaginationBar page={2} totalPages={5} total={58} label="registros" onPrev={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByText('Página 2 de 5 (58 registros)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '← Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente →' })).toBeInTheDocument();
  });

  it('deshabilita Anterior en la primera página', () => {
    render(
      <PaginationBar page={1} totalPages={3} total={30} label="productos" onPrev={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente →' })).toBeEnabled();
  });

  it('deshabilita Siguiente en la última página', () => {
    render(
      <PaginationBar page={3} totalPages={3} total={30} label="productos" onPrev={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Siguiente →' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '← Anterior' })).toBeEnabled();
  });

  it('dispara onPrev y onNext al hacer clic', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <PaginationBar page={2} totalPages={4} total={40} label="citas" onPrev={onPrev} onNext={onNext} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '← Anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
