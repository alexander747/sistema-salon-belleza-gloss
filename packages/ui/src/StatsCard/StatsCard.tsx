import React from 'react';
import { motion } from 'framer-motion';
import styles from './StatsCard.module.css';

export interface StatsCardTrend {
  value: number;
  positive: boolean;
}

export interface StatsCardProps {
  icon: string;
  value: string | number;
  label: string;
  trend?: StatsCardTrend;
  className?: string;
  style?: React.CSSProperties;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  value,
  label,
  trend,
  className,
  style,
}) => {
  const classNames = [styles.card, className ?? ''].filter(Boolean).join(' ');

  return (
    <motion.div
      className={classNames}
      style={style}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const }}
    >
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        {trend && (
          <span
            className={`${styles.trend} ${trend.positive ? styles.trendPositive : styles.trendNegative}`}
          >
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <motion.div
        className={styles.value}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const }}
      >
        {value}
      </motion.div>
      <div className={styles.label}>{label}</div>
    </motion.div>
  );
};
