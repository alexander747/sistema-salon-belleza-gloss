import React from 'react';
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

export const Layout: React.FC<LayoutProps> = ({
  children,
  sidebarItems,
  onLogout,
  userName,
  title,
}) => {
  const location = useLocation();

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLogo}>
            <span className={styles.sidebarLogoAccent}>POS</span>·Final
          </span>
        </div>
        <div className={styles.sidebarDivider} />
        <nav className={styles.sidebarNav}>
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <motion.div
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Link
                  key={item.href}
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
          {userName && (
            <div className={styles.topBarUser}>
              <span className={styles.topBarUserDot} />
              {userName}
            </div>
          )}
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
