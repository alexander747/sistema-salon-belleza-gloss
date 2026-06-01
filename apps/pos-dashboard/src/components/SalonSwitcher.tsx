import React, { useEffect, useState } from 'react';
import type { ISalon } from '@pos-final/types';
import api from '../services/api.js';

interface SalonSwitcherProps {
  userSalonId: number;
}

const SalonSwitcher: React.FC<SalonSwitcherProps> = ({ userSalonId }) => {
  const [salones, setSalones] = useState<ISalon[]>([]);

  useEffect(() => {
    api
      .get('/superadmin/salones')
      .then(({ data }) => setSalones(data))
      .catch(() => {
        /* silent — user might lose permission mid-session */
      });
  }, []);

  const storedId = localStorage.getItem('xSalonId');
  const selectedId = storedId ? Number(storedId) : null;

  const currentSalon = selectedId
    ? salones.find((s) => s.id === selectedId)
    : salones.find((s) => s.id === userSalonId);

  // Auto-select first salon if superadmin and no salon is selected
  useEffect(() => {
    if (salones.length > 0 && !selectedId && !currentSalon) {
      const firstId = salones[0].id;
      localStorage.setItem('xSalonId', String(firstId));
      window.location.reload();
    }
  }, [salones, selectedId, currentSalon]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      localStorage.setItem('xSalonId', val);
    } else {
      localStorage.removeItem('xSalonId');
    }
    window.location.reload();
  };

  return (
    <select
      value={selectedId ?? ''}
      onChange={handleChange}
      style={{
        height: '36px',
        padding: '0 2rem 0 0.75rem',
        borderRadius: '8px',
        border: '1px solid rgba(212, 168, 83, 0.25)',
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.8125rem',
        color: 'var(--text-primary)',
        outline: 'none',
        cursor: 'pointer',
        minWidth: '200px',
        maxWidth: '300px',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#d4a853';
        e.target.style.boxShadow =
          '0 0 0 2px rgba(212, 168, 83, 0.15), 0 2px 8px rgba(0,0,0,0.2)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = 'rgba(212, 168, 83, 0.25)';
        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      }}
    >
      <option value="">
        🏪{' '}
        {currentSalon && !selectedId
          ? currentSalon.nombre
          : 'Todos los salones'}
      </option>
      {salones.map((s) => (
        <option key={s.id} value={s.id}>
          🏪 {s.nombre}
        </option>
      ))}
    </select>
  );
};

export default SalonSwitcher;
