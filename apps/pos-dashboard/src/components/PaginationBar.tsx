import React from 'react';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  /** Sustantivo del listado, p. ej. "registros" → "(58 registros)". */
  label: string;
  onPrev: () => void;
  onNext: () => void;
}

const btnStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  padding: '0.55rem 1.1rem',
  minHeight: 40,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

/** Patrón estándar de paginación: ← Anterior / Página X de Y (Z label) / Siguiente → */
const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  totalPages,
  total,
  label,
  onPrev,
  onNext,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        marginTop: '1rem',
        alignItems: 'center',
      }}
    >
      <button
        disabled={page <= 1}
        onClick={onPrev}
        style={{
          ...btnStyle,
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
          opacity: page <= 1 ? 0.5 : 1,
        }}
      >
        ← Anterior
      </button>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Página {page} de {totalPages} ({total} {label})
      </span>
      <button
        disabled={page >= totalPages}
        onClick={onNext}
        style={{
          ...btnStyle,
          cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          opacity: page >= totalPages ? 0.5 : 1,
        }}
      >
        Siguiente →
      </button>
    </div>
  );
};

export default PaginationBar;
