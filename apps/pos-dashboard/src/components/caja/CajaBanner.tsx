import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rol, type IUser } from '@pos-final/types';
import api from '../../services/api.js';

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

const ROLES_CAJA: Rol[] = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA];

/** Solo estos roles pueden abrir/cerrar caja (spec finanzas-caja). */
export function puedeGestionarCaja(user: IUser | null | undefined): boolean {
  return !!user && ROLES_CAJA.includes(user.rol);
}

/* ================================================================ */
/*  HELPERS                                                          */
/* ================================================================ */

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '$0';
  return currencyFormatter.format(n);
}

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

  const fetchCaja = useCallback(async () => {
    if (!salonId) return;
    try {
      const { data } = await api.get(`/salones/${salonId}/caja/actual`);
      setCaja(data?.data ?? null);
    } catch {
      // 404 CAJA_NO_ABIERTA → caja cerrada (banner ámbar)
      setCaja(null);
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
          {abierta ? 'Cerrar' : 'Abrir'}
        </button>
      )}
    </motion.div>
  );
};

export default CajaBanner;
