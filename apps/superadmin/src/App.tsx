import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LoginPage from './pages/LoginPage.js';
import DashboardPage from './pages/DashboardPage.js';
import SalonListPage from './pages/SalonListPage.js';
import CreateSalonPage from './pages/CreateSalonPage.js';
import EditSalonPage from './pages/EditSalonPage.js';
import SalonDetailPage from './pages/SalonDetailPage.js';
import PlanesPage from './pages/PlanesPage.js';
import ProtectedRoute from './components/ProtectedRoute.js';

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as const }}
      >
        <Routes location={location}>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/salones/nuevo" element={<CreateSalonPage />} />
            <Route path="/salones/:id/editar" element={<EditSalonPage />} />
            <Route path="/salones/:id" element={<SalonDetailPage />} />
            <Route path="/salones" element={<SalonListPage />} />
            <Route path="/planes" element={<PlanesPage />} />
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
