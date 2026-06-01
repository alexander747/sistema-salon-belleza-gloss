import React from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hoverable?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<CardBodyProps>;
  Footer: React.FC<CardFooterProps>;
} = ({ children, className, hoverable, style }) => {
  const classNames = [
    styles.card,
    hoverable ? styles.hoverable : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return hoverable ? (
    <motion.div
      className={classNames}
      style={style}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      {children}
    </motion.div>
  ) : (
    <div className={classNames} style={style}>{children}</div>
  );
};

const Header: React.FC<CardHeaderProps> = ({ children, className }) => {
  const classNames = [styles.header, className ?? ''].filter(Boolean).join(' ');
  return <div className={classNames}>{children}</div>;
};

const Body: React.FC<CardBodyProps> = ({ children, className, style }) => {
  const classNames = [styles.body, className ?? ''].filter(Boolean).join(' ');
  return <div className={classNames} style={style}>{children}</div>;
};

const Footer: React.FC<CardFooterProps> = ({ children, className }) => {
  const classNames = [styles.footer, className ?? ''].filter(Boolean).join(' ');
  return <div className={classNames}>{children}</div>;
};

Card.Header = Header;
Card.Body = Body;
Card.Footer = Footer;
