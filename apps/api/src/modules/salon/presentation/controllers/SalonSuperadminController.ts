import { injectable, inject } from 'tsyringe';
import type { Request, Response } from 'express';
import { CreateSalonUseCase } from '../../application/use-cases/CreateSalonUseCase';
import { DeleteSalonUseCase } from '../../application/use-cases/DeleteSalonUseCase';
import { ListSalonesUseCase } from '../../application/use-cases/ListSalonesUseCase';
import { GetSalonByIdUseCase } from '../../application/use-cases/GetSalonByIdUseCase';
import { UpdateSalonUseCase } from '../../application/use-cases/UpdateSalonUseCase';

@injectable()
export class SalonSuperadminController {
  constructor(
    @inject(CreateSalonUseCase) private readonly createSalonUseCase: CreateSalonUseCase,
    @inject(DeleteSalonUseCase) private readonly deleteSalonUseCase: DeleteSalonUseCase,
    @inject(ListSalonesUseCase) private readonly listSalonesUseCase: ListSalonesUseCase,
    @inject(GetSalonByIdUseCase) private readonly getSalonByIdUseCase: GetSalonByIdUseCase,
    @inject(UpdateSalonUseCase) private readonly updateSalonUseCase: UpdateSalonUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const {
      nombre,
      numeroWhatsApp,
      nombreBot,
      tonoVoz,
      logoUrl,
      colorPrimario,
      colorSecundario,
      tema,
      horasCancelacion,
      dueñaNombre,
      dueñaEmail,
      dueñaPassword,
      dueñaWhatsApp,
    } = req.body;

    const result = await this.createSalonUseCase.execute(
      { nombre, numeroWhatsApp, nombreBot, tonoVoz, logoUrl, colorPrimario, colorSecundario, tema, horasCancelacion },
      dueñaNombre ?? `${nombre} Dueña`,
      dueñaEmail ?? `duena@${nombre.toLowerCase().replace(/\s+/g, '')}.com`,
      dueñaPassword ?? 'duena123',
      dueñaWhatsApp ?? numeroWhatsApp,
    );
    res.status(201).json(result);
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.listSalonesUseCase.execute();
    res.status(200).json(result);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const result = await this.getSalonByIdUseCase.execute(id);
    res.status(200).json(result);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const result = await this.updateSalonUseCase.execute(id, req.body);
    res.status(200).json(result);
  };

  toggle = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const salon = await this.getSalonByIdUseCase.execute(id);
    const result = await this.updateSalonUseCase.execute(id, { activo: !salon.activo });
    res.status(200).json(result);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    await this.deleteSalonUseCase.execute(id);
    res.status(200).json({ ok: true });
  };
}
