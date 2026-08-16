/**
 * Cálculo de antigüedad de deuda en días de negocio de Colombia (UTC-5).
 * Funciones puras: sin I/O, deterministas con la fecha "hoy" inyectable.
 */
import { getColombiaDateString, colombiaDayStartUTC } from '../../../../../shared/colombia-date';
import type { AntiguedadBucket } from '../../dtos/CuentasDTO';

const MS_PER_DAY = 86_400_000;

/** Días transcurridos (en fechas de Colombia) entre creadoEn y hoy. */
export function antiguedadDiasColombia(creadoEn: Date, hoy: Date = new Date()): number {
  const desde = colombiaDayStartUTC(getColombiaDateString(creadoEn));
  const hasta = colombiaDayStartUTC(getColombiaDateString(hoy));
  return Math.round((hasta.getTime() - desde.getTime()) / MS_PER_DAY);
}

/**
 * Bucket de antigüedad: 0-30, 31-60, 61-90, 90+ (90 queda en 61-90; 91+ en 90+).
 */
export function bucketAntiguedad(dias: number): AntiguedadBucket {
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '90+';
}
