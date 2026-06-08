import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api.js';
import styles from './HorariosPage.module.css';

const DIAS = [
  { id: 0, label: 'Domingo' },
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
];

interface HorarioDia {
  diaSemana: number;
  horaApertura: string;
  horaCierre: string;
  estaAbierto: boolean;
}

const HorariosPage: React.FC = () => {
  const [horarios, setHorarios] = useState<HorarioDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchHorarios();
  }, []);

  const fetchHorarios = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/salones/1/agenda/horarios');
      // Normalize to array of 7 days
      const normalized = DIAS.map((dia) => {
        const existing = data.find((h: HorarioDia) => h.diaSemana === dia.id);
        return existing || {
          diaSemana: dia.id,
          horaApertura: '08:00',
          horaCierre: '18:00',
          estaAbierto: true,
        };
      });
      setHorarios(normalized);
    } catch (err) {
      console.error('Error fetching horarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (diaSemana: number, field: keyof HorarioDia, value: any) => {
    setHorarios((prev) =>
      prev.map((h) =>
        h.diaSemana === diaSemana ? { ...h, [field]: value } : h
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/salones/1/agenda/horarios', horarios);
      setMessage('Horarios guardados correctamente');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', margin: 0 }}>
          Horarios Comerciales
        </h1>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div className={styles.toolbar}>
        <div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Horarios Comerciales
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              margin: '0.25rem 0 0',
            }}
          >
            Configura los horarios de atención por día de la semana
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--bg-root)',
            padding: '0.5rem 1.25rem',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            boxShadow: '0 2px 12px rgba(212,168,83,0.25)',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: message.includes('Error')
              ? 'rgba(224, 85, 106, 0.08)'
              : 'rgba(92, 184, 148, 0.08)',
            border: `1px solid ${message.includes('Error') ? 'rgba(224, 85, 106, 0.2)' : 'rgba(92, 184, 148, 0.2)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8125rem',
            color: message.includes('Error') ? 'var(--danger)' : 'var(--success)',
          }}
        >
          {message}
        </motion.div>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Día</th>
              <th>Abierto</th>
              <th>Apertura</th>
              <th>Cierre</th>
            </tr>
          </thead>
          <tbody>
            {horarios.map((h) => (
              <tr key={h.diaSemana} className={styles.tableRow}>
                <td style={{ fontWeight: 600 }}>
                  {DIAS.find((d) => d.id === h.diaSemana)?.label}
                </td>
                <td>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={h.estaAbierto}
                      onChange={(e) =>
                        handleChange(h.diaSemana, 'estaAbierto', e.target.checked)
                      }
                    />
                    <span className={styles.slider}></span>
                  </label>
                </td>
                <td>
                  <input
                    type="time"
                    value={h.horaApertura}
                    onChange={(e) =>
                      handleChange(h.diaSemana, 'horaApertura', e.target.value)
                    }
                    disabled={!h.estaAbierto}
                    className={styles.timeInput}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={h.horaCierre}
                    onChange={(e) =>
                      handleChange(h.diaSemana, 'horaCierre', e.target.value)
                    }
                    disabled={!h.estaAbierto}
                    className={styles.timeInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HorariosPage;
