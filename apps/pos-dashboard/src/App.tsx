import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] as const }}
      >
        <Routes location={location}>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
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
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
};

export default App;
