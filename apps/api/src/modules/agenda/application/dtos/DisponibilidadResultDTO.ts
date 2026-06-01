export class DisponibilidadResultDTO {
  readonly disponible: boolean;
  readonly motivo?: string;
  readonly fechaInicio?: string;
  readonly fechaFin?: string;

  constructor(params: {
    disponible: boolean;
    motivo?: string;
    fechaInicio?: string;
    fechaFin?: string;
  }) {
    this.disponible = params.disponible;
    this.motivo = params.motivo;
    this.fechaInicio = params.fechaInicio;
    this.fechaFin = params.fechaFin;
  }
}
