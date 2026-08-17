import React, { useEffect, useRef, useState } from 'react';
import { computeMoneyCaret, formatMoneyDigits } from '../utils/moneyInput.js';

interface MoneyInputProps {
  /** Valor numérico (COP entero). 0 se muestra como campo vacío. */
  value: number;
  /** Recibe el número en bruto (dígitos) — sin separadores. */
  onChange: (n: number) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
  id?: string;
  autoFocus?: boolean;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

/**
 * Input de texto para montos con separador de miles (es-CO).
 * Preserva la posición del caret mientras el usuario edita.
 */
const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  style,
  className,
  ariaLabel,
  id,
  autoFocus,
  onFocus,
  onBlur,
}) => {
  const [digits, setDigits] = useState(value ? String(Math.trunc(value)) : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  // Sincroniza con cambios externos del value (precarga de edición, resets).
  useEffect(() => {
    const next = value ? String(Math.trunc(value)) : '';
    setDigits((prev) => (prev === next ? prev : next));
  }, [value]);

  // Aplica el caret pendiente después de que React commitea el nuevo valor.
  useEffect(() => {
    if (pendingCaretRef.current !== null && inputRef.current) {
      const pos = pendingCaretRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      pendingCaretRef.current = null;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const caret = e.target.selectionStart ?? raw.length;
    const digitsBefore = e.target.value.slice(0, caret).replace(/\D/g, '').length;

    pendingCaretRef.current = computeMoneyCaret(formatMoneyDigits(raw), digitsBefore);
    setDigits(raw);
    onChange(raw ? Number(raw) : 0);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      id={id}
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      className={className}
      autoFocus={autoFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      value={formatMoneyDigits(digits)}
      onChange={handleChange}
    />
  );
};

export default MoneyInput;
