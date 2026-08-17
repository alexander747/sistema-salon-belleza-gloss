import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TableSkeleton from '../TableSkeleton';

describe('TableSkeleton', () => {
  it('renderiza el thead con las columnas provistas', () => {
    render(<TableSkeleton columns={['Nombre', 'Email', 'Rol', 'Acciones']} rows={3} />);

    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Rol')).toBeInTheDocument();
    expect(screen.getByText('Acciones')).toBeInTheDocument();
  });

  it('renderiza la cantidad de filas shimmer solicitada', () => {
    render(<TableSkeleton columns={['A', 'B']} rows={5} />);

    const rows = screen.getAllByTestId('table-skeleton-row');
    expect(rows).toHaveLength(5);
  });

  it('usa 5 filas por defecto cuando no se especifican', () => {
    render(<TableSkeleton columns={['A']} />);

    expect(screen.getAllByTestId('table-skeleton-row')).toHaveLength(5);
  });

  it('usa columnas por defecto cuando no se especifican', () => {
    render(<TableSkeleton rows={2} />);

    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Acciones')).toBeInTheDocument();
    expect(screen.getAllByTestId('table-skeleton-row')).toHaveLength(2);
  });
});
