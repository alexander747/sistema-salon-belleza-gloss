import { injectable, inject } from 'tsyringe';
import type { Request, Response } from 'express';
import { GetSalonByApiKeyUseCase } from '../../application/use-cases/GetSalonByApiKeyUseCase';

@injectable()
export class SalonN8nController {
  constructor(
    @inject(GetSalonByApiKeyUseCase) private readonly getSalonUseCase: GetSalonByApiKeyUseCase,
  ) {}

  getSalon = async (req: Request, res: Response): Promise<void> => {
    const salonId = parseInt(req.params.salonId, 10);
    const result = await this.getSalonUseCase.execute(salonId);
    res.status(200).json(result);
  };

  healthCheck = async (req: Request, res: Response): Promise<void> => {
    const salonId = parseInt(req.params.salonId, 10);
    res.status(200).json({ status: 'ok', salonId });
  };
}
