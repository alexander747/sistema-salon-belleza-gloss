import React from 'react';
import styles from './TableSkeleton.module.css';

const DEFAULT_COLUMNS = ['Nombre', 'Detalle', 'Estado', 'Fecha', 'Acciones'];

interface TableSkeletonProps {
  rows?: number;
  columns?: string[];
}

/** Skeleton de tabla con shimmer: thead + N filas (patrón EmpleadasPage). */
const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns }) => {
  const cols = columns ?? DEFAULT_COLUMNS;

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead className={styles.tableHead}>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
      </table>
      <div style={{ padding: '0.25rem 1rem' }}>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            data-testid="table-skeleton-row"
            style={{
              display: 'flex',
              gap: '1rem',
              padding: '0.7rem 0',
              alignItems: 'center',
              borderBottom: i < rows - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            {cols.map((_, j) => (
              <div
                key={j}
                className={styles.skeletonBlock}
                style={{ height: 14, flex: 1 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableSkeleton;
