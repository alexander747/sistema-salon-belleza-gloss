import { injectable, inject } from 'tsyringe';
import type { IBloqueoAgendaRepository } from '../../../domain/ports/IBloqueoAgendaRepository';
import { NotFoundError } from '../../../../../shared/errors';

export interface DeleteBloqueoInput {
  id: number;
}

@injectable()
export class DeleteBloqueoUseCase {
  constructor(
    @inject('IBloqueoAgendaRepository') private readonly bloqueoRepo: IBloqueoAgendaRepository,
  ) {}

  async execute(input: DeleteBloqueoInput): Promise<boolean> {
    const deleted = await this.bloqueoRepo.delete(input.id);
    if (!deleted) {
      throw new NotFoundError('Bloqueo no encontrado');
    }

    return true;
  }
}
