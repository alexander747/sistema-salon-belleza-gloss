import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListProductosUseCase } from '../../application/use-cases/producto/ListProductosUseCase';
import { GetProductoUseCase } from '../../application/use-cases/producto/GetProductoUseCase';
import { CreateProductoUseCase } from '../../application/use-cases/producto/CreateProductoUseCase';
import { UpdateProductoUseCase } from '../../application/use-cases/producto/UpdateProductoUseCase';
import { DescontarStockUseCase } from '../../application/use-cases/producto/DescontarStockUseCase';
import { ReabastecerStockUseCase } from '../../application/use-cases/producto/ReabastecerStockUseCase';
import { DeleteProductoUseCase } from '../../application/use-cases/producto/DeleteProductoUseCase';
import type { TipoInventario } from '../../../../infrastructure/persistence/entities/ProductoEntity';

@injectable()
export class ProductoController {
  constructor(
    @inject('ListProductosUseCase') private readonly listUseCase: ListProductosUseCase,
    @inject('GetProductoUseCase') private readonly getUseCase: GetProductoUseCase,
    @inject('CreateProductoUseCase') private readonly createUseCase: CreateProductoUseCase,
    @inject('UpdateProductoUseCase') private readonly updateUseCase: UpdateProductoUseCase,
    @inject('DescontarStockUseCase') private readonly descontarUseCase: DescontarStockUseCase,
    @inject('ReabastecerStockUseCase') private readonly reabastecerUseCase: ReabastecerStockUseCase,
    @inject('DeleteProductoUseCase') private readonly deleteUseCase: DeleteProductoUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tipoInventario = req.query.tipo
        ? (req.query.tipo as TipoInventario)
        : undefined;
      const result = await this.listUseCase.execute({
        salonId: req.salonId!,
        tipoInventario,
        userRol: req.user?.rol,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
        userRol: req.user?.rol,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.createUseCase.execute({
        salonId: req.salonId!,
        ...req.body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
        ...req.body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  descontar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.descontarUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
        cantidad: req.body.cantidad,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  reabastecer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.reabastecerUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
        cantidad: req.body.cantidad,
        precioCompra: req.body.precioCompra,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deleteUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
