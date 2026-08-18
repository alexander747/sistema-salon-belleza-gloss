import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Rol } from '@pos-final/types';
import { ThemeProvider } from '../../context/ThemeContext';
import { setMobileMedia } from '../../test/setMobileMedia';
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

/** Igual que renderLayout pero con rutas hijas reales para verificar navegación. */
function renderLayoutWithRoutes(rol: Rol, initialEntry = '/clientes') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ThemeProvider>
        <Routes>
          <Route
            element={
              <LuxeLayout
                user={{ nombre: 'Ana', rol, salon: null }}
                onLogout={vi.fn()}
                loading={false}
              />
            }
          >
            <Route path="/clientes" element={<div>Clientes Page</div>} />
            <Route path="/agenda" element={<div>Agenda Page</div>} />
          </Route>
        </Routes>
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

  it('SUPERADMIN: ve todas las páginas, sin Configuración (UI muerta eliminada)', () => {
    renderLayout(Rol.SUPERADMIN);

    for (const label of ['Dashboard', 'Citas', 'Clientes', 'Servicios', 'Empleados', 'Productos', 'Categorías', 'Ventas', 'Finanzas', 'Préstamos', 'Horarios']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    // El botón "Configuración" no-op fue eliminado del sidebar
    expect(screen.queryAllByText('Configuración')).toHaveLength(0);
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

describe('LuxeLayout — móvil (drawer temporal < md)', () => {
  beforeEach(() => {
    setMobileMedia(false); // cada test arranca en desktop; los casos móviles re-mockean antes de render
    localStorage.clear();
  });

  it('móvil: muestra hamburger y NO el toggle de colapso', () => {
    setMobileMedia(true);
    renderLayout(Rol.DUEÑA);

    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Colapsar menú|Expandir menú/ })).toBeNull();
  });

  it('desktop: NO hay hamburger y sí el toggle de colapso', () => {
    renderLayout(Rol.DUEÑA);

    expect(screen.queryByRole('button', { name: 'Abrir menú' })).toBeNull();
    expect(screen.getByRole('button', { name: /Colapsar menú|Expandir menú/ })).toBeInTheDocument();
  });

  it('móvil: el drawer es temporal (panel con role dialog al abrir); desktop: permanente sin dialog', () => {
    setMobileMedia(true);
    renderLayout(Rol.DUEÑA);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('desktop: sin role dialog (drawer permanente)', () => {
    renderLayout(Rol.DUEÑA);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('móvil: los ítems de nav siguen en el DOM (keepMounted) y el hamburger abre el drawer navegable', () => {
    setMobileMedia(true);
    renderLayoutWithRoutes(Rol.DUEÑA);

    // keepMounted: el nav está en el DOM incluso con el drawer cerrado
    expect(screen.getByText('Citas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(screen.getByText('Citas'));

    expect(screen.getByText('Agenda Page')).toBeInTheDocument();
  });

  it('móvil: respeta el colapso guardado en localStorage como expandido y sigue mostrando el rol real', () => {
    localStorage.setItem('sidebarCollapsed', 'true');
    setMobileMedia(true);
    renderLayout(Rol.MANICURISTA);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    // En móvil el drawer siempre se ve expandido (etiquetas visibles, no tooltips)
    expect(screen.getByText('Citas')).toBeInTheDocument();
    // El rol real vive en el drawer (el bloque de usuario se mueve ahí en móvil)
    expect(screen.getByText('Manicurista')).toBeInTheDocument();
    expect(screen.queryByText('Dueña')).toBeNull();
  });
});
