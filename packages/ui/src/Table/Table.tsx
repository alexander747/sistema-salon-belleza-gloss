import React from 'react';
import styles from './Table.module.css';

export interface TableColumn {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface TableProps {
  columns: TableColumn[];
  data: Record<string, unknown>[];
  className?: string;
  style?: React.CSSProperties;
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  className,
  style,
}) => {
  const wrapperClass = [styles.tableWrapper, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass} style={style}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            {columns.map((col) => (
              <th key={col.key} className={styles.headerCell}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className={styles.bodyRow}>
              {columns.map((col) => (
                <td key={col.key} className={styles.bodyCell}>
                  {col.render
                    ? col.render(row[col.key], row)
                    : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
