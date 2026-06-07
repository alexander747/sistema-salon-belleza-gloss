import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api.js';

/* ── Types ── */

interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  cedula?: string | null;
}

export interface ClienteSearchableSelectProps {
  salonId: number;
  value: number | null;
  /** Name to display when value was set externally (e.g., from create flow) */
  selectedName?: string;
  onSelect: (cliente: {
    id: number;
    nombre: string;
    telefono: string;
    cedula?: string | null;
  }) => void;
  onCreateNew: () => void;
  placeholder?: string;
  disabled?: boolean;
}

/* ── Helpers ── */

function formatPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

/* ── Component ── */

const ClienteSearchableSelect: React.FC<ClienteSearchableSelectProps> = ({
  salonId,
  value,
  selectedName,
  onSelect,
  onCreateNew,
  placeholder = 'Buscar cliente por nombre, celular o cédula...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /* ── Syncing external value changes ── */
  useEffect(() => {
    if (!value || value <= 0) {
      setSelectedClient(null);
    }
  }, [value]);

  /* ── API fetch ── */
  const fetchClients = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = { limit: 10 };
        if (searchQuery.trim()) params.q = searchQuery.trim();
        const { data } = await api.get(`/salones/${salonId}/clientes`, { params });
        const list = Array.isArray(data) ? data : (data as { data?: Cliente[] })?.data ?? [];
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [salonId],
  );

  /* ── Debounced search ── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchClients(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchClients]);

  /* ── Open on focus (load recent) ── */
  const handleFocus = () => {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      if (!query) fetchClients('');
    }
  };

  /* ── Click outside ── */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Reset highlight on new results ── */
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  /* ── Select ── */
  const selectClient = (cliente: Cliente) => {
    setSelectedClient(cliente);
    setQuery('');
    setIsOpen(false);
    onSelect({
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono ?? '',
      cedula: cliente.cedula,
    });
    inputRef.current?.blur();
  };

  /* ── Clear selection ── */
  const clearSelection = () => {
    setSelectedClient(null);
    setQuery('');
    setResults([]);
    onSelect({ id: 0, nombre: '', telefono: '' });
    inputRef.current?.focus();
  };

  /* ── Keyboard navigation ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        if (!query) fetchClients('');
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev,
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          selectClient(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  /* ── Input change ── */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    if (value && value > 0) {
      // Clear the previous selection when user types
      setSelectedClient(null);
      onSelect({ id: 0, nombre: '', telefono: '' });
    }
  };

  /* ── Determine display value ── */
  const displayValue = (() => {
    const hasValue = value != null && value > 0;
    if (!hasValue) return query;
    // Show name from local cache, external prop, or fall back to query
    if (selectedClient?.id === value) return selectedClient.nombre;
    if (selectedName) return selectedName;
    return query;
  })();

  /* ── Base input style (reuses project's formInput look) ── */
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 0.7rem',
    paddingRight: value && value > 0 ? 28 : 10,
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
    background: disabled ? 'var(--bg-elevated)' : 'var(--bg-base)',
    color: 'var(--text-primary)',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.8125rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    cursor: disabled ? 'not-allowed' : 'text',
    boxShadow: isOpen ? '0 0 0 2px var(--accent-glow)' : 'none',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ── Input ── */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={inputStyle}
        />
        {value != null && value > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Limpiar cliente"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 200,
              marginTop: 2,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Loading */}
            {loading && (
              <div
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                }}
              >
                Buscando...
              </div>
            )}

            {/* No results */}
            {!loading && query.trim() && results.length === 0 && (
              <div
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                }}
              >
                No se encontraron clientes
              </div>
            )}

            {/* Results list */}
            {!loading && results.length > 0 && (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {results.map((cliente, index) => (
                  <div
                    key={cliente.id}
                    role="option"
                    aria-selected={index === highlightedIndex}
                    onClick={() => selectClient(cliente)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      background:
                        index === highlightedIndex
                          ? 'var(--bg-hover)'
                          : 'transparent',
                      borderBottom:
                        index < results.length - 1
                          ? '1px solid var(--border)'
                          : 'none',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontSize: '0.8rem' }}>👤</span>
                      <span
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {cliente.nombre}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        marginLeft: '1.4rem',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.7rem',
                          color: 'var(--text-dim)',
                        }}
                      >
                        🆔 {cliente.cedula || '—'}
                      </span>
                      <span
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.7rem',
                          color: 'var(--text-dim)',
                        }}
                      >
                        📱 {cliente.telefono ? formatPhone(cliente.telefono) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create new button */}
            <div
              role="button"
              tabIndex={0}
              onClick={onCreateNew}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreateNew();
              }}
              style={{
                padding: '0.65rem 0.75rem',
                cursor: 'pointer',
                borderTop: '1px solid var(--border)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--accent)',
                textAlign: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--accent-subtle)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              + Crear nuevo cliente
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClienteSearchableSelect;
