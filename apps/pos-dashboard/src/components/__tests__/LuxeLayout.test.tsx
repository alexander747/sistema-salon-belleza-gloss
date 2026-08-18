import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rol } from '@pos-final/types';
import { ThemeProvider } from '../../context/ThemeContext';
import LuxeLayout from '../LuxeLayout';

function renderLayout(rol: Rol) {
  return render(
    <MemoryRouter initialEntries={['/clientes']}>
      <ThemeProvider>
        <LuxeLayout
          user={{ nombre: 'Ana', rol, salon: null }}
          onLogout={vi.fn()}
          loading={false}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('LuxeLayout — navegación filtrada por rol', () => {
  it('MANICURISTA: ve solo las páginas de atención (sin Finanzas, Ventas, Empleados, Productos...)', () => {
    renderLayout(Rol.MANICURISTA);

    // Permitidas
    // Permitidas (pueden aparecer en sidebar + título del header en /clientes)
    for (const label of ['Dashboard', 'Citas', 'Clientes', 'Servicios', 'Horarios']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }

    // Prohibidas: NO deben aparecer en el sidebar
    expect(screen.queryAllByText('Finanzas')).toHaveLength(0);
    expect(screen.queryAllByText('Ventas')).toHaveLength(0);
    expect(screen.queryAllByText('Empleados')).toHaveLength(0);
    expect(screen.queryAllByText('Productos')).toHaveLength(0);
    expect(screen.queryAllByText('Categorías')).toHaveLength(0);
    expect(screen.queryAllByText('Préstamos')).toHaveLength(0);
    expect(screen.queryAllByText('Configuración')).toHaveLength(0);
  });

  it('RECEPCIONISTA: ve Ventas y Finanzas pero no Préstamos ni Empleados', () => {
    renderLayout(Rol.RECEPCIONISTA);

    for (const label of ['Dashboard', 'Citas', 'Clientes', 'Ventas', 'Finanzas', 'Horarios']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }

    expect(screen.queryAllByText('Préstamos')).toHaveLength(0);
    expect(screen.queryAllByText('Empleados')).toHaveLength(0);
    expect(screen.queryAllByText('Servicios')).toHaveLength(0);
    expect(screen.queryAllByText('Productos')).toHaveLength(0);
  });

  it('CONTADOR: ve Finanzas y catálogo, sin Ventas/Citas/Empleados', () => {
    renderLayout(Rol.CONTADOR);

    for (const label of ['Dashboard', 'Finanzas', 'Clientes', 'Servicios', 'Productos', 'Categorías']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }

    expect(screen.queryAllByText('Ventas')).toHaveLength(0);
    expect(screen.queryAllByText('Citas')).toHaveLength(0);
    expect(screen.queryAllByText('Empleados')).toHaveLength(0);
    expect(screen.queryAllByText('Préstamos')).toHaveLength(0);
    expect(screen.queryAllByText('Horarios')).toHaveLength(0);
  });

  it('DUEÑA: ve todas las páginas y Configuración NO (solo SUPERADMIN)', () => {
    renderLayout(Rol.DUEÑA);

    for (const label of ['Dashboard', 'Citas', 'Clientes', 'Servicios', 'Empleados', 'Productos', 'Categorías', 'Ventas', 'Finanzas', 'Préstamos', 'Horarios']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.queryAllByText('Configuración')).toHaveLength(0);
  });

  it('SUPERADMIN: ve todas las páginas + Configuración', () => {
    renderLayout(Rol.SUPERADMIN);

    for (const label of ['Dashboard', 'Citas', 'Clientes', 'Servicios', 'Empleados', 'Productos', 'Categorías', 'Ventas', 'Finanzas', 'Préstamos', 'Horarios']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getByText('Configuración')).toBeInTheDocument();
  });
});

describe('LuxeLayout — header con rol real', () => {
  it('muestra el rol real del usuario (Manicurista), no "Dueña" hardcodeado', () => {
    renderLayout(Rol.MANICURISTA);

    expect(screen.getByText('Manicurista')).toBeInTheDocument();
    expect(screen.queryAllByText('Dueña')).toHaveLength(0);
  });

  it('muestra "Dueña" solo para el rol DUEÑA', () => {
    renderLayout(Rol.DUEÑA);

    expect(screen.getByText('Dueña')).toBeInTheDocument();
  });

  it('muestra "Recepcionista" para el rol RECEPCIONISTA', () => {
    renderLayout(Rol.RECEPCIONISTA);

    expect(screen.getByText('Recepcionista')).toBeInTheDocument();
  });
});
