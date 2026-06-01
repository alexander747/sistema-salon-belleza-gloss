import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage.js';
import DashboardPage from './pages/DashboardPage.js';
import AgendaPage from './pages/AgendaPage.js';
import ServiciosPage from './pages/ServiciosPage.js';
import ProductosPage from './pages/ProductosPage.js';
import CategoriasPage from './pages/CategoriasPage.js';
import ClientesPage from './pages/ClientesPage.js';
import EmpleadasPage from './pages/EmpleadasPage.js';
import FinanzasPage from './pages/FinanzasPage.js';
import VentasPage from './pages/VentasPage.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import LuxeLayout from './components/LuxeLayout.js';
import api from './services/api.js';

/* ── Wrapper: provides LuxeLayout with auth state ── */

const ProtectedLayout: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ nombre?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  return (
    <LuxeLayout
      userName={user?.nombre}
      onLogout={handleLogout}
      loading={loading}
    />
  );
};

/* ── Routes ── */

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/servicios" element={<ServiciosPage />} />
              <Route path="/productos" element={<ProductosPage />} />
              <Route path="/categorias" element={<CategoriasPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/empleadas" element={<EmpleadasPage />} />
              <Route path="/ventas" element={<VentasPage />} />
              <Route path="/finanzas" element={<FinanzasPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
