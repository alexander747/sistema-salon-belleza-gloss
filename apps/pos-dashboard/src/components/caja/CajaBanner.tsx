import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rol, type IUser } from '@pos-final/types';
import api from '../../services/api.js';
import { formatCurrency } from '../../utils/format.js';

export { formatCurrency };

/* ================================================================ */
/*  TIPOS COMPARTIDOS DE CAJA                                        */
/* ================================================================ */

export interface CajaDTO {
  id: number;
  salonId: number;
  fechaCaja: string;
  montoInicial: number;
  montoEsperado: number | null;
  montoRealEfectivo: number | null;
  diferencia: number | null;
  estado: 'ABIERTA' | 'CERRADA';
  aperturaPorId: number | null;
  aperturaEn: string;
  cierrePorId: number | null;
  cierreEn: string | null;
  creadoEn: string;
}

export const CAJA_REFRESH_EVENT = 'caja-refresh';

/** Notifica a banners/tabs de caja montados en otras páginas que recarguen su estado. */
export function dispatchCajaRefresh(): void {
  window.dispatchEvent(new CustomEvent(CAJA_REFRESH_EVENT));
}

/**
 * Día comercial Colombia (UTC-5, sin DST) como YYYY-MM-DD.
 * Espejo del backend (shared/colombia-date.ts): la frontera del día es 05:00 UTC.
 */
export function getColombiaDateString(): string {
  const now = new Date();
  const colombiaTime = new Date(now.getTime() + now.getTimezoneOffset() * 60_000 - 5 * 3_600_000);
  const y = colombiaTime.getUTCFullYear();
  const m = String(colombiaTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(colombiaTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ROLES_CAJA: Rol[] = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA];

/** Solo estos roles pueden abrir/cerrar caja (spec finanzas-caja). */
export function puedeGestionarCaja(user: IUser | null | undefined): boolean {
  return !!user && ROLES_CAJA.includes(user.rol);
}

/* ================================================================ */
/*  HELPERS                                                          */
/* ================================================================ */

/* ================================================================ */
/*  CAJA BANNER                                                      */
/* ================================================================ */

interface CajaBannerProps {
  salonId: number | null;
  user?: IUser | null;
  /** FinanzasPage: cambia de tab sin navegar; otras páginas: navega a /finanzas?tab=caja */
  onNavigateToCaja?: () => void;
}

const CajaBanner: React.FC<CajaBannerProps> = ({ salonId, user, onNavigateToCaja }) => {
  const navigate = useNavigate();
  const [caja, setCaja] = useState<CajaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  // La caja de HOY ya fue cerrada (p. ej. para almorzar) → el banner ofrece "Reabrir" en vez de "Abrir"
  const [hoyCerrada, setHoyCerrada] = useState(false);

  const fetchCaja = useCallback(async () => {
    if (!salonId) return;
    try {
      const { data } = await api.get(`/salones/${salonId}/caja/actual`);
      setCaja(data?.data ?? null);
      setHoyCerrada(false);
    } catch {
      // 404 CAJA_NO_ABIERTA → sin caja abierta: ver si la de HOY ya se cerró (para ofrecer "Reabrir")
      setCaja(null);
      try {
        const { data: hist } = await api.get(`/salones/${salonId}/caja/cierres?page=1&limit=1`);
        const cierres = Array.isArray(hist?.data?.data) ? hist.data.data : [];
        setHoyCerrada(
          cierres.length > 0 &&
          cierres[0].estado === 'CERRADA' &&
          cierres[0].fechaCaja === getColombiaDateString(),
        );
      } catch {
        setHoyCerrada(false);
      }
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    fetchCaja();
    const handler = () => fetchCaja();
    window.addEventListener(CAJA_REFRESH_EVENT, handler);
    return () => window.removeEventListener(CAJA_REFRESH_EVENT, handler);
  }, [fetchCaja]);

  const handleAction = () => {
    if (onNavigateToCaja) onNavigateToCaja();
    else navigate('/finanzas?tab=caja');
  };

  // Sin salon (auth pendiente) o primer fetch: no renderizar hasta tener estado real
  if (loading) return null;

  const abierta = !!caja && caja.estado === 'ABIERTA';
  const canManage = puedeGestionarCaja(user);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.65rem 1rem',
        borderRadius: 'var(--radius-md)',
        marginBottom: '1rem',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.8125rem',
        fontWeight: 600,
        ...(abierta
          ? {
              background: 'rgba(92,186,123,0.12)',
              border: '1px solid rgba(92,186,123,0.3)',
              color: 'var(--success)',
            }
          : {
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.3)',
              color: '#fbbf24',
            }),
      }}
    >
      <span style={{ lineHeight: 1.5 }}>
        {abierta
          ? `💰 Caja abierta — fondo ${formatCurrency(caja?.montoInicial)}`
          : hoyCerrada
            ? '💰 Caja cerrada hoy — Reabrir para vender'
            : 'Caja cerrada — Abrir para vender'}
      </span>

      {canManage && (
        <button
          onClick={handleAction}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.35rem 0.9rem',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.75rem',
            fontWeight: 700,
            color: abierta ? 'var(--danger)' : 'var(--accent)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {abierta ? 'Cerrar' : hoyCerrada ? 'Reabrir' : 'Abrir'}
        </button>
      )}
    </motion.div>
  );
};

export default CajaBanner;
