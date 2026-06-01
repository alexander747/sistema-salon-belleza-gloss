export interface SalonOutput {
  id: number;
  nombre: string;
  numeroWhatsApp: string;
  nombreBot: string;
  tonoVoz: string;
  plan: string;
  estado: string;
  activo: boolean;
  apiKeyN8n: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  tema: string | null;
  horasCancelacion: number;
  creadoEn: Date;
  ownerEmail: string | null;
}

export interface CreateSalonInput {
  nombre: string;
  numeroWhatsApp: string;
  nombreBot?: string;
  tonoVoz?: string;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  tema?: string | null;
  horasCancelacion?: number;
}
