import { injectable, inject } from 'tsyringe';
import type { CreateRegistroInput } from '@pos-final/validation';
import { MetodoPago } from '../../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import { AppDataSource } from '../../../../../shared/database';
import { ClienteEntity } from '../../../../../infrastructure/persistence/entities/ClienteEntity';
import { RegistroProductoEntity } from '../../../../../infrastructure/persistence/entities/RegistroProductoEntity';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IPagoTransaccionRepository } from '../../../domain/ports/IPagoTransaccionRepository';
import type { IDivisionRegistroRepository } from '../../../domain/ports/IDivisionRegistroRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import { ComisionService } from '../../services/ComisionService';
import type { RegistroServicioDTO } from '../../dtos/RegistroServicioDTO';
import { registroServicioToDTO } from '../../dtos/RegistroServicioDTO';
import { NotFoundError } from '../../../../../shared/errors';

@injectable()
export class CreateRegistroUseCase {
  constructor(
    @inject('IRegistroServicioRepository') private readonly registroRepo: IRegistroServicioRepository,
    @inject('IPagoTransaccionRepository') private readonly pagoRepo: IPagoTransaccionRepository,
    @inject('IDivisionRegistroRepository') private readonly divisionRepo: IDivisionRegistroRepository,
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
    @inject(ComisionService) private readonly comisionService: ComisionService,
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: CreateRegistroInput): Promise<RegistroServicioDTO> {
    // ── 1. Validate cliente exists ────────────────────────────
    const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, input.clienteId);
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    // ── 2. Validate usuario (employee) exists ─────────────────
    const usuario = await this.usuarioRepo.findBySalonAndId(input.salonId, input.usuarioId);
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // ── 3. Get employee's commission percentage ───────────────
    const porcentaje = Number(usuario.porcentajeComisionServicio);

    // ── 4. Calculate financial values ─────────────────────────
    const comisionCalculada = this.comisionService.calcularComision(
      input.totalServicios,
      porcentaje,
    );
    const montoTotal = this.comisionService.calcularMontoTotal(
      input.totalServicios,
      input.totalProductos,
      input.propina,
    );
    const totalPagado = (input.pagos ?? []).reduce((sum, p) => sum + p.monto, 0);
    const montoPendiente = this.comisionService.calcularMontoPendiente(
      input.totalServicios,
      input.totalProductos,
      totalPagado,
    );

    // ── 4a. Price adjustment fields ──────────────────────────
    const porcentajeDescuento = input.porcentajeDescuento ?? 0;
    const valorOriginal = montoTotal; // sum before any discount
    const valorFinal = input.valorFinal ?? montoTotal;
    // Use frontend's explicit flag; fallback to false if not provided
    const precioAjustado = input.precioAjustado ?? false;

    // ── 5. Transaction ────────────────────────────────────────
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 6. Create RegistroServicio ──────────────────────────
      // Calculate total product quantity sold
      const cantidadProductosVendidos = input.productosVendidos?.reduce(
        (sum, pv) => sum + (pv.cantidad ?? 1), 0
      ) ?? 0;

      const registro = await this.registroRepo.create(
        {
          salonId: input.salonId,
          clienteId: input.clienteId,
          usuarioId: input.usuarioId,
          totalServicios: input.totalServicios,
          totalProductos: input.totalProductos,
          cantidadProductosVendidos,
          montoTotal,
          propina: input.propina,
          comisionCalculada,
          esRetoque: input.esRetoque ?? false,
          descripcionServicio: input.descripcionServicio,
          montoPendiente,
          notas: input.notas,
          registradoPorId: input.registradoPorId,
          // Price adjustment fields
          precioAjustado,
          porcentajeDescuento,
          valorOriginal,
          valorFinal,
        },
        queryRunner,
      );

      // ── 7. Create PagoTransaccion rows ──────────────────────
      if (input.pagos && input.pagos.length > 0) {
        const pagosData = input.pagos.map((p) => ({
          registroServicioId: registro.id,
          monto: p.monto,
          metodoPago: p.metodoPago as MetodoPago,
          referencia: p.referencia,
        }));
        await this.pagoRepo.bulkCreate(pagosData, queryRunner);
      }

      // ── 8. Create DivisionRegistro rows ─────────────────────
      if (input.divisiones && input.divisiones.length > 0) {
        for (const div of input.divisiones) {
          await this.divisionRepo.create(
            {
              registroServicioId: registro.id,
              usuarioId: div.usuarioId,
              porcentajeParticipacion: div.porcentaje,
              comisionCorrespondiente: div.monto,
            },
            queryRunner,
          );
        }
      }

      // ── 9. Update Cliente stats within the same transaction ─
      await queryRunner.manager.getRepository(ClienteEntity).update(cliente.id, {
        ultimaVisita: new Date(),
        totalServicios: Number(cliente.totalServicios ?? 0) + 1,
        deudaTotal: Number(Number(cliente.deudaTotal ?? 0) + montoPendiente),
      });

      // ── 10. Save product lines & decrement stock ─────────────
      if (input.productosVendidos && input.productosVendidos.length > 0) {
        for (const pv of input.productosVendidos) {
          // Fetch product to get current price
          const producto = await this.productoRepo.findBySalonAndId(
            input.salonId,
            pv.productoId,
          );
          if (!producto) continue;

          const precioVentaUnitario = Number(producto.precioVenta);
          const subtotal = precioVentaUnitario * pv.cantidad;

          const registroProducto = queryRunner.manager
            .getRepository(RegistroProductoEntity)
            .create({
              registroServicioId: registro.id,
              productoId: pv.productoId,
              cantidad: pv.cantidad,
              precioVentaUnitario,
              subtotal,
            });
          await queryRunner.manager
            .getRepository(RegistroProductoEntity)
            .save(registroProducto);

          // Decrement stock within the same transaction
          await this.productoRepo.decrementStock(
            pv.productoId,
            pv.cantidad,
            queryRunner,
          );
        }
      }

      await queryRunner.commitTransaction();

      // Re-fetch with relations for the DTO
      const saved = await this.registroRepo.findById(registro.id);
      return registroServicioToDTO(saved!);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
