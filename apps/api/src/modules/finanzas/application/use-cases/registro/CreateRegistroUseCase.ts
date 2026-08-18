import { injectable, inject } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import type { CreateRegistroInput } from '@pos-final/validation';
import { MetodoPago } from '../../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import { AppDataSource } from '../../../../../shared/database';
import { ClienteEntity } from '../../../../../infrastructure/persistence/entities/ClienteEntity';
import { RegistroProductoEntity } from '../../../../../infrastructure/persistence/entities/RegistroProductoEntity';
import { RegistroServicioItemEntity } from '../../../../../infrastructure/persistence/entities/RegistroServicioItemEntity';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IPagoTransaccionRepository } from '../../../domain/ports/IPagoTransaccionRepository';
import type { IDivisionRegistroRepository } from '../../../domain/ports/IDivisionRegistroRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import { ComisionService } from '../../services/ComisionService';
import { verificarCajaAbierta } from '../../services/verificarCajaAbierta';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { RegistroServicioDTO } from '../../dtos/RegistroServicioDTO';
import { registroServicioToDTO } from '../../dtos/RegistroServicioDTO';
import { NotFoundError } from '../../../../../shared/errors';

/**
 * Input extendido: además del payload validado por HTTP, permite fijar
 * `citaId` cuando el registro se crea dentro del flujo atómico de completar
 * cita (nunca llega por HTTP — lo inyecta el use case dueño de la transacción).
 */
export type CreateRegistroInputConCita = CreateRegistroInput & { citaId?: number | null };

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
    @inject('ICajaRepository') private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(
    input: CreateRegistroInputConCita,
    queryRunner?: QueryRunner,
  ): Promise<RegistroServicioDTO> {
    // ── 0. Regla de oro: no se vende sin caja abierta ──────────
    const caja = await verificarCajaAbierta(this.cajaRepo, input.salonId);

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
    const totalCostoBaseInsumos = (input.serviciosItems ?? [])
      .reduce((sum, si) => sum + (si.costoBaseInsumos ?? 0), 0);

    const montoTotal = this.comisionService.calcularMontoTotal(
      input.totalServicios,
      input.totalProductos,
      input.propina,
    );

    // ── 4a. Price adjustment fields ──────────────────────────
    const porcentajeDescuento = input.porcentajeDescuento ?? 0;
    const propina = input.propina ?? 0;
    const valorOriginal = montoTotal; // sum before any discount
    const valorFinal = input.valorFinal ?? montoTotal;
    // Use frontend's explicit flag; fallback to false if not provided
    const precioAjustado = input.precioAjustado ?? false;

    // ── 4b. Commission on ADJUSTED services total ────────────
    // Commission is computed on what the client actually paid for services:
    // prorate totalServicios by (valorFinal - propina) / (montoTotal - propina).
    const baseBruta = montoTotal - propina;
    const baseReal = valorFinal - propina;
    const proporcion = baseBruta > 0 ? baseReal / baseBruta : 1;
    const totalServiciosAjustado = Math.round(Number(input.totalServicios) * proporcion);

    const comisionCalculada = this.comisionService.calcularComision(
      totalServiciosAjustado,
      porcentaje,
      totalCostoBaseInsumos,
    );

    const totalPagado = (input.pagos ?? []).reduce((sum, p) => sum + p.monto, 0);
    // montoPendiente se computa sobre el valor REAL cobrado (valorFinal, ya
    // ajustado por descuento/precio personalizado), excluyendo la propina —
    // misma semántica que la comisión. Con el bruto pre-descuento el cliente
    // que paga el total descontado quedaría debiendo el descuento (deuda falsa).
    const montoPendiente = this.comisionService.calcularMontoPendiente(
      valorFinal,
      propina,
      totalPagado,
    );

    // ── 5. Transaction ────────────────────────────────────────
    // Si el caller ya abrió una transacción (qr), la usamos y NO tocamos el
    // ciclo de vida (commit/rollback/release) — el dueño es el caller.
    // Sin qr → comportamiento legacy: transacción propia.
    const ownTx = !queryRunner;
    const qr = queryRunner ?? AppDataSource.createQueryRunner();
    if (ownTx) {
      await qr.connect();
      await qr.startTransaction();
    }

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
          cajaId: caja.id,
          citaId: input.citaId ?? null,
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
        qr,
      );

      // ── 7. Create PagoTransaccion rows ──────────────────────
      if (input.pagos && input.pagos.length > 0) {
        const pagosData = input.pagos.map((p) => ({
          registroServicioId: registro.id,
          monto: p.monto,
          metodoPago: p.metodoPago as MetodoPago,
          referencia: p.referencia,
        }));
        await this.pagoRepo.bulkCreate(pagosData, qr);
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
            qr,
          );
        }
      }

      // ── 9. Update Cliente stats within the same transaction ─
      await qr.manager.getRepository(ClienteEntity).update(cliente.id, {
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

          const registroProducto = qr.manager
            .getRepository(RegistroProductoEntity)
            .create({
              registroServicioId: registro.id,
              productoId: pv.productoId,
              cantidad: pv.cantidad,
              precioVentaUnitario,
              subtotal,
            });
          await qr.manager
            .getRepository(RegistroProductoEntity)
            .save(registroProducto);

          // Decrement stock within the same transaction
          await this.productoRepo.decrementStock(
            pv.productoId,
            pv.cantidad,
            qr,
          );
        }
      }

      // ── 11. Persist servicio items ──────────────────────────
      if (input.serviciosItems && input.serviciosItems.length > 0) {
        const servicioItemRepo = qr.manager.getRepository(RegistroServicioItemEntity);
        for (const si of input.serviciosItems) {
          const item = servicioItemRepo.create({
            registroServicioId: registro.id,
            servicioId: si.servicioId,
            nombreServicio: si.nombreServicio,
            precioServicio: si.precioServicio,
            costoBaseInsumos: si.costoBaseInsumos ?? 0,
          });
          await servicioItemRepo.save(item);
        }
      }

      if (ownTx) {
        await qr.commitTransaction();

        // Re-fetch with relations for the DTO (post-commit, repo default)
        const saved = await this.registroRepo.findById(registro.id);
        return registroServicioToDTO(saved!);
      }

      // Modo compartido: el caller es dueño del commit y del re-fetch.
      // Devolvemos el DTO desde la entidad recién persistida (id + escalares).
      return registroServicioToDTO(registro);
    } catch (error) {
      if (ownTx) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      if (ownTx) {
        await qr.release();
      }
    }
  }
}
