import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TypeaheadSelect.module.css';

export interface TypeaheadOption {
  id: number;
  nombre: string;
  /** Secondary text shown on the right (e.g. role, phone). */
  hint?: string;
}

export interface TypeaheadSelectProps {
  /** Already-loaded options; the input filters them client-side by `nombre`/`hint`. */
  options: TypeaheadOption[];
  value: number | '';
  onChange: (id: number | '') => void;
  placeholder?: string;
  /** Accessible name for the input (also used by tests). */
  ariaLabel?: string;
  inputId?: string;
  emptyText?: string;
}

/**
 * Accessible type-ahead used in the mobile wizard for Cliente/Empleada.
 *
 * Unlike `ClienteSearchableSelect` (server-side search), this filters an
 * in-memory list, mirroring the service/product catalog search. It renders an
 * `<input role="combobox">` plus a `role="listbox"` of `role="option"` rows so
 * thousands of records never become a native `<select>`.
 */
const TypeaheadSelect: React.FC<TypeaheadSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  inputId,
  emptyText = 'Sin resultados',
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = inputId ? `${inputId}-list` : undefined;

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.nombre.toLowerCase().includes(q) ||
        (o.hint != null && o.hint.toLowerCase().includes(q)),
    );
  }, [options, query]);

  /* Close on click outside. */
  useEffect(() => {
    const onDocumentMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, []);

  /* Highlight reset when the visible list changes. */
  useEffect(() => {
    setHighlighted(-1);
  }, [filtered]);

  /** While typing show the query; otherwise keep the committed name visible. */
  const displayValue = open && query !== '' ? query : (selected?.nombre ?? '');
  const showClear = value !== '' && !open;

  const commit = (option: TypeaheadOption) => {
    onChange(option.id);
    setQuery('');
    setOpen(false);
    setHighlighted(-1);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
    setHighlighted(-1);
  };

  const handleFocus = () => {
    setQuery('');
    setOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    // Typing starts a new search: drop the previous committed selection.
    if (value !== '') onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlighted >= 0 && highlighted < filtered.length) {
          commit(filtered[highlighted]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.inputWrap}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
          value={displayValue}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={styles.input}
          style={showClear ? { paddingRight: 28 } : undefined}
        />
        {showClear && (
          <button
            type="button"
            className={styles.clear}
            aria-label={ariaLabel ? `Limpiar ${ariaLabel}` : 'Limpiar'}
            onClick={clear}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div id={listId} role="listbox" className={styles.dropdown}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>{emptyText}</div>
          ) : (
            filtered.map((option, index) => (
              <div
                key={option.id}
                role="option"
                aria-selected={option.id === value}
                className={`${styles.option} ${index === highlighted ? styles.optionHighlighted : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => commit(option)}
              >
                <span className={styles.optionName}>{option.nombre}</span>
                {option.hint != null && (
                  <span className={styles.optionHint}>{option.hint}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TypeaheadSelect;
