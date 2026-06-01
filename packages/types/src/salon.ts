export enum Plan {
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
}

export type EstadoSalon = 'ACTIVO' | 'SUSPENDIDO';

/** Core salon entity shape shared across frontend and backend. */
export interface ISalon {
  id: number;
  nombre: string;
  numeroWhatsApp: string;
  nombreBot: string;
  tonoVoz: string;
  logoUrl?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  tema?: string;
  activo: boolean;
  apiKeyN8n: string;
  plan: Plan;
  estado: EstadoSalon;
  faqBase?: Record<string, unknown>;
  redesSociales?: Record<string, unknown>;
  horasCancelacion: number;
  reglasTemporada?: Record<string, unknown>;
  creadoEn: Date;
  actualizadoEn: Date;
  ownerEmail: string | null;
}
