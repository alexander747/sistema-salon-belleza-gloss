import React from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className,
}) => {
  const classNames = [styles.badge, styles[variant], className ?? '']
    .filter(Boolean)
    .join(' ');

  return <span className={classNames}>{children}</span>;
};
