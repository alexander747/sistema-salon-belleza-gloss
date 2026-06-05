import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './Layout.module.css';

export interface SidebarItem {
  label: string;
  href: string;
  icon?: string;
}

export interface LayoutProps {
  children: React.ReactNode;
  sidebarItems: SidebarItem[];
  onLogout: () => void;
  userName?: string;
  title: string;
}

const THEME_KEY = 'superadmin-theme';

function getInitialTheme(): 'dark' | 'light' {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme);
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  sidebarItems,
  onLogout,
  userName,
  title,
}) => {
  const location = useLocation();
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLogo}>
            <span className={styles.sidebarLogoAccent}>Sistema</span>Pro
          </span>
        </div>
        <div className={styles.sidebarDivider} />
        <nav className={styles.sidebarNav}>
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <motion.div
                key={item.href}
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Link
                  to={item.href}
                  className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ''}`}
                >
                  {item.icon && <span className={styles.sidebarLinkIcon}>{item.icon}</span>}
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <button className={styles.sidebarLogoutBtn} onClick={onLogout}>
            <span className={styles.sidebarLinkIcon}>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topBar}>
          <h1 className={styles.topBarTitle}>{title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className={styles.themeToggle}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {userName && (
              <div className={styles.topBarUser}>
                <span className={styles.topBarUserDot} />
                {userName}
              </div>
            )}
          </div>
        </header>
        <motion.main
          className={styles.content}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] as const }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};
