import React from 'react';
import { formatCurrency } from '../utils/format.js';
import type { DesgloseReparto as Desglose } from '../utils/reparto.js';
import styles from './DesgloseReparto.module.css';

interface DesgloseRepartoProps {
  /** Resultado de `calcularDesgloseReparto` (espejo de la fórmula del servidor). */
  desglose: Desglose;
  /** % de comisión de la empleada; `null` → no se muestra el split. */
  porcentajeComision: number | null;
}

/**
 * Explica visualmente cómo se reparte el dinero de una venta:
 * `Cobrado − Insumos = A repartir`, y el reparto por % de la empleada.
 * Compartido por la venta de mostrador (WalkInModal) y "completar cita".
 */
const DesgloseReparto: React.FC<DesgloseRepartoProps> = ({ desglose, porcentajeComision }) => (
  <div className={styles.panel} role="group" aria-label="Desglose del reparto">
    <div className={styles.title}>¿Cómo se reparte?</div>
    <div className={styles.row}>
      <span className={styles.label}>Cobrado</span>
      <span
        className={styles.value}
        aria-label={`Cobrado ${formatCurrency(desglose.cobradoServicios)}`}
      >
        {formatCurrency(desglose.cobradoServicios)}
      </span>
    </div>
    <div className={styles.row}>
      <span className={styles.label}>Insumos</span>
      <span
        className={styles.valueRestar}
        aria-label={`Insumos − ${formatCurrency(desglose.insumos)}`}
      >
        {`− ${formatCurrency(desglose.insumos)}`}
      </span>
    </div>
    <div className={styles.rowResultado}>
      <span className={styles.resultadoLabel}>A repartir</span>
      <span
        className={styles.resultadoValue}
        aria-label={`A repartir ${formatCurrency(desglose.aRepartir)}`}
      >
        {formatCurrency(desglose.aRepartir)}
      </span>
    </div>
    {porcentajeComision != null && (
      <>
        <div className={styles.row}>
          <span className={styles.label}>Comisión empleada ({porcentajeComision}%)</span>
          <span
            className={styles.comision}
            aria-label={`Comisión empleada ${formatCurrency(desglose.comisionEmpleada)}`}
          >
            {formatCurrency(desglose.comisionEmpleada)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Queda para el salón</span>
          <span
            className={styles.salon}
            aria-label={`Queda para el salón ${formatCurrency(desglose.quedaSalon)}`}
          >
            {formatCurrency(desglose.quedaSalon)}
          </span>
        </div>
      </>
    )}
    {desglose.insumoSuperaCobrado && (
      <p className={styles.aviso}>
        La comisión queda en $0 porque el insumo supera el total cobrado.
      </p>
    )}
    <p className={styles.helper}>
      El costo de insumos se descuenta del total cobrado y el resto se reparte entre la empleada y
      el salón.
    </p>
  </div>
);

export default DesgloseReparto;
