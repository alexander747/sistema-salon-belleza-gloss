import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import { NotFoundError } from '../../../../../shared/errors';

export interface AnularRegistroInput {
  id: number;
  salonId: number;
}

@injectable()
export class AnularRegistroUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IClienteRepository')
    private readonly clienteRepo: IClienteRepository,
    @inject('IProductoRepository')
    private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: AnularRegistroInput): Promise<void> {
    const registro = await this.registroRepo.findById(input.id);
    if (!registro) {
      throw new NotFoundError('Registro no encontrado');
    }

    // --- Stock restoration ---
    // The registro's totalProductos is the monetary amount of products sold.
    // Currently there is no line-items relation (lineasProductos) on
    // RegistroServicioEntity, so we cannot determine WHICH individual products
    // were sold and in what quantities. Without that mapping we cannot restore
    // stock per product.
    // If a lineasProductos relation is added in the future, iterate over it
    // here and call this.productoRepo.incrementStock(productoId, cantidad).
    if (Number(registro.totalProductos) > 0) {
      console.log(
        `[AnularRegistro] Registro #${input.id} had $${registro.totalProductos} in product sales, ` +
        'but no product-line relation exists yet — stock was NOT restored automatically.',
      );
    }

    // Soft-void: zero out financial impact, preserve audit trail
    const montoPendienteAnterior = Number(registro.montoPendiente);

    await this.registroRepo.update(input.id, {
      montoPendiente: 0,
      montoTotal: 0,
      comisionCalculada: 0,
      estaPagadaEmpleada: true,
      notas: registro.notas
        ? `[ANULADO] ${registro.notas}`
        : '[ANULADO]',
    });

    // Decrement cliente's debt by the previous pending amount
    if (montoPendienteAnterior > 0) {
      const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, registro.clienteId);
      if (cliente) {
        const nuevaDeuda = Math.max(0, Number(cliente.deudaTotal ?? 0) - montoPendienteAnterior);
        await this.clienteRepo.update(cliente.id, {
          deudaTotal: nuevaDeuda,
        });
      }
    }
  }
}
