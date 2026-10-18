import React, { useCallback, useEffect, useState } from 'react';
import { Rol, type IUser } from '@pos-final/types';
import api from '../../services/api.js';
import { formatCurrency } from '../../utils/format.js';
import { dispatchCajaRefresh } from './CajaBanner.js';
import MoneyInput from '../MoneyInput.js';
import HelpTip from '../HelpTip.js';

/* ================================================================ */
/*  TIPOS / PERMISOS                                                 */
/* ================================================================ */

export interface SaldoInicialCajaDTO {
  /** Capital que el negocio ya tenía antes del sistema. NO es ingreso. */
  saldoInicialCaja: number;
  /** Saldo inicial + efecto de caja acumulado de las cajas cerradas (informativo). */
  posicionCaja: number;
}

/** Roles que pueden VER la posición de caja (mismos que ven la caja). */
const ROLES_VER: Rol[] = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR];
/** Solo DUEÑA/SUPERADMIN pueden EDITAR el saldo inicial (decisión owner). */
const ROLES_EDITAR: Rol[] = [Rol.SUPERADMIN, Rol.DUEÑA];

export function puedeVerPosicionCaja(user: IUser | null | undefined): boolean {
  return !!user && ROLES_VER.includes(user.rol);
}

export function puedeEditarSaldoInicial(user: IUser | null | undefined): boolean {
  return !!user && ROLES_EDITAR.includes(user.rol);
}

/* ================================================================ */
/*  ESTILOS (patrón CajaTab / FinanzasPage)                          */
/* ================================================================ */

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem 1.25rem',
  marginBottom: '1rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '0.2rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-root)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '0.55rem 0.8rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.875rem',
  outline: 'none',
};

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--bg-root)',
  padding: '0.45rem 1.1rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

const ghostBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  padding: '0.45rem 1.1rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

/* ================================================================ */
/*  COMPONENTE                                                       */
/* ================================================================ */

interface SaldoInicialCajaCardProps {
  salonId: number | null;
  user: IUser | null;
}

/**
 * Tarjeta informativa "Posición de caja" + edición del "Saldo inicial de caja".
 *
 * El saldo inicial es la plata que el negocio ya tenía ANTES del sistema: es el
 * punto de partida de la caja, NO ganancia, y nunca entra al P&L. Solo se
 * renderiza cuando la lectura del API devuelve un payload válido (mientras no
 * haya datos no se inventa un $0).
 */
const SaldoInicialCajaCard: React.FC<SaldoInicialCajaCardProps> = ({ salonId, user }) => {
  const [data, setData] = useState<SaldoInicialCajaDTO | null>(null);
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = puedeVerPosicionCaja(user);
  const canEdit = puedeEditarSaldoInicial(user);

  const fetchSaldo = useCallback(async () => {
    if (!salonId || !visible) return;
    try {
      const { data: res } = await api.get(`/salones/${salonId}/caja/saldo-inicial`);
      const payload = res?.data;
      if (
        payload &&
        typeof payload.saldoInicialCaja === 'number' &&
        typeof payload.posicionCaja === 'number'
      ) {
        setData({ saldoInicialCaja: payload.saldoInicialCaja, posicionCaja: payload.posicionCaja });
      } else {
        setData(null);
      }
    } catch {
      // Sin datos no se muestra la tarjeta (no se fabrica un $0).
      setData(null);
    }
  }, [salonId, visible]);

  useEffect(() => {
    fetchSaldo();
  }, [fetchSaldo]);

  const startEdit = () => {
    setValor(data?.saldoInicialCaja ?? 0);
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const save = async () => {
    if (!salonId) return;
    setSaving(true);
    setError(null);
    try {
      const { data: res } = await api.put(`/salones/${salonId}/caja/saldo-inicial`, {
        saldoInicialCaja: valor,
      });
      const payload = res?.data;
      if (payload) {
        setData({
          saldoInicialCaja: payload.saldoInicialCaja,
          posicionCaja: payload.posicionCaja,
        });
      }
      setEditing(false);
      setSaved(true);
      dispatchCajaRefresh();
    } catch {
      setError('No se pudo guardar el saldo inicial. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !data) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          💰 Posición de caja
          <HelpTip
            label="Posición de caja"
            text="Plata real que debería haber hoy: el saldo inicial del negocio más lo que acumuló la caja (cobros en efectivo menos gastos y egresos en efectivo de las cajas cerradas). Es informativo: NO es ganancia."
          />
        </h3>
        <span
          data-testid="posicion-caja-valor"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--accent)',
          }}
        >
          {formatCurrency(data.posicionCaja)}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginTop: '0.9rem',
          borderTop: '1px solid var(--border)',
          paddingTop: '0.75rem',
        }}
      >
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Saldo inicial de caja
            <HelpTip
              label="Saldo inicial de caja"
              text="Plata que el negocio ya tenía antes de usar el sistema. Es el punto de partida, NO es ganancia."
            />
          </div>
          {editing ? (
            <MoneyInput
              id="saldoInicialCaja"
              ariaLabel="Saldo inicial de caja"
              value={valor}
              onChange={setValor}
              placeholder="0"
              style={{ ...inputStyle, maxWidth: 260 }}
            />
          ) : (
            <div
              data-testid="saldo-inicial-valor"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {formatCurrency(data.saldoInicialCaja)}
            </div>
          )}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  style={ghostBtnStyle}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            ) : (
              <button type="button" onClick={startEdit} style={primaryBtnStyle}>
                Editar
              </button>
            )}
          </div>
        )}
      </div>

      {saved && !editing && (
        <p
          role="status"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.75rem',
            color: 'var(--success)',
            margin: '0.6rem 0 0',
          }}
        >
          Saldo inicial actualizado.
        </p>
      )}
      {error && (
        <p
          role="alert"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.75rem',
            color: 'var(--danger)',
            margin: '0.6rem 0 0',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default SaldoInicialCajaCard;
