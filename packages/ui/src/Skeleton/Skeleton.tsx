import React from 'react';
import styles from './Skeleton.module.css';

type SkeletonVariant = 'text' | 'circle' | 'rect';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: SkeletonVariant;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'text',
  className,
  style,
}) => {
  const classNames = [
    styles.skeleton,
    styles[variant],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  if (variant === 'circle' && !mergedStyle.width) {
    mergedStyle.width = mergedStyle.height || '40px';
  }
  if (variant === 'circle' && !mergedStyle.height) {
    mergedStyle.height = mergedStyle.width || '40px';
  }

  return <div className={classNames} style={mergedStyle} />;
};
