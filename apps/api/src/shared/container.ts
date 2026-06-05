import 'reflect-metadata';
import { container } from 'tsyringe';
import { AppDataSource } from './database';

// Auth Module
import { TypeORMUsuarioRepository } from '../modules/auth/infrastructure/repositories/TypeORMUsuarioRepository';
import { BcryptService } from '../modules/auth/infrastructure/services/BcryptService';
import { JwtTokenService } from '../modules/auth/infrastructure/services/JwtTokenService';
import { LoginUseCase } from '../modules/auth/application/use-cases/LoginUseCase';
import { RefreshTokenUseCase } from '../modules/auth/application/use-cases/RefreshTokenUseCase';
import { GetCurrentUserUseCase } from '../modules/auth/application/use-cases/GetCurrentUserUseCase';
import { AuthController } from '../modules/auth/presentation/controllers/AuthController';

// Salon Module
import { TypeORMSalonRepository } from '../modules/salon/infrastructure/repositories/TypeORMSalonRepository';
import { CreateSalonUseCase } from '../modules/salon/application/use-cases/CreateSalonUseCase';
import { ListSalonesUseCase } from '../modules/salon/application/use-cases/ListSalonesUseCase';
import { GetSalonByApiKeyUseCase } from '../modules/salon/application/use-cases/GetSalonByApiKeyUseCase';
import { SalonSuperadminController } from '../modules/salon/presentation/controllers/SalonSuperadminController';
import { SalonN8nController } from '../modules/salon/presentation/controllers/SalonN8nController';

// Catalogo Module — Repositories
import { TypeORMCategoriaServicioRepository } from '../modules/catalogo/infrastructure/persistence/TypeORMCategoriaServicioRepository';
import { TypeORMServicioRepository } from '../modules/catalogo/infrastructure/persistence/TypeORMServicioRepository';
import { TypeORMProductoRepository } from '../modules/catalogo/infrastructure/persistence/TypeORMProductoRepository';

// Catalogo Module — Use Cases (Categorías)
import { ListCategoriasUseCase } from '../modules/catalogo/application/use-cases/categoria/ListCategoriasUseCase';
import { CreateCategoriaUseCase } from '../modules/catalogo/application/use-cases/categoria/CreateCategoriaUseCase';
import { UpdateCategoriaUseCase } from '../modules/catalogo/application/use-cases/categoria/UpdateCategoriaUseCase';
import { DeleteCategoriaUseCase } from '../modules/catalogo/application/use-cases/categoria/DeleteCategoriaUseCase';

// Catalogo Module — Use Cases (Servicios)
import { ListServiciosUseCase } from '../modules/catalogo/application/use-cases/servicio/ListServiciosUseCase';
import { GetServicioUseCase } from '../modules/catalogo/application/use-cases/servicio/GetServicioUseCase';
import { CreateServicioUseCase } from '../modules/catalogo/application/use-cases/servicio/CreateServicioUseCase';
import { UpdateServicioUseCase } from '../modules/catalogo/application/use-cases/servicio/UpdateServicioUseCase';
import { DeleteServicioUseCase } from '../modules/catalogo/application/use-cases/servicio/DeleteServicioUseCase';

// Catalogo Module — Use Cases (Productos)
import { ListProductosUseCase } from '../modules/catalogo/application/use-cases/producto/ListProductosUseCase';
import { GetProductoUseCase } from '../modules/catalogo/application/use-cases/producto/GetProductoUseCase';
import { CreateProductoUseCase } from '../modules/catalogo/application/use-cases/producto/CreateProductoUseCase';
import { UpdateProductoUseCase } from '../modules/catalogo/application/use-cases/producto/UpdateProductoUseCase';
import { DescontarStockUseCase } from '../modules/catalogo/application/use-cases/producto/DescontarStockUseCase';
import { ReabastecerStockUseCase } from '../modules/catalogo/application/use-cases/producto/ReabastecerStockUseCase';
import { DeleteProductoUseCase } from '../modules/catalogo/application/use-cases/producto/DeleteProductoUseCase';

// Personas Module — Repositories
import { TypeORMUsuarioRepository as PersonasTypeORMUsuarioRepository } from '../modules/personas/infrastructure/persistence/TypeORMUsuarioRepository';
import { TypeORMClienteRepository } from '../modules/personas/infrastructure/persistence/TypeORMClienteRepository';

// Personas Module — Use Cases (Empleadas)
import { ListEmpleadasUseCase } from '../modules/personas/application/use-cases/empleada/ListEmpleadasUseCase';
import { GetEmpleadaUseCase } from '../modules/personas/application/use-cases/empleada/GetEmpleadaUseCase';
import { CreateEmpleadaUseCase } from '../modules/personas/application/use-cases/empleada/CreateEmpleadaUseCase';
import { UpdateEmpleadaUseCase } from '../modules/personas/application/use-cases/empleada/UpdateEmpleadaUseCase';
import { ActivateEmpleadaUseCase } from '../modules/personas/application/use-cases/empleada/ActivateEmpleadaUseCase';
import { DeactivateEmpleadaUseCase } from '../modules/personas/application/use-cases/empleada/DeactivateEmpleadaUseCase';

// Personas Module — Use Cases (Clientes)
import { ListClientesUseCase } from '../modules/personas/application/use-cases/cliente/ListClientesUseCase';
import { GetClienteUseCase } from '../modules/personas/application/use-cases/cliente/GetClienteUseCase';
import { CreateClienteUseCase } from '../modules/personas/application/use-cases/cliente/CreateClienteUseCase';
import { UpdateClienteUseCase } from '../modules/personas/application/use-cases/cliente/UpdateClienteUseCase';

// Personas Module — Controllers
import { EmpleadaController } from '../modules/personas/presentation/controllers/EmpleadaController';
import { ClienteController } from '../modules/personas/presentation/controllers/ClienteController';

// Agenda Module — Repositories
import { TypeORMCitaRepository } from '../modules/agenda/infrastructure/persistence/TypeORMCitaRepository';
import { TypeORMBloqueoAgendaRepository } from '../modules/agenda/infrastructure/persistence/TypeORMBloqueoAgendaRepository';
import { TypeORMHorarioComercialRepository } from '../modules/agenda/infrastructure/persistence/TypeORMHorarioComercialRepository';
import { DisponibilidadService } from '../modules/agenda/application/services/DisponibilidadService';

// Agenda Module — Use Cases (Citas)
import { ListCitasUseCase } from '../modules/agenda/application/use-cases/cita/ListCitasUseCase';
import { GetCitaUseCase } from '../modules/agenda/application/use-cases/cita/GetCitaUseCase';
import { CreateCitaUseCase } from '../modules/agenda/application/use-cases/cita/CreateCitaUseCase';
import { CambiarEstadoCitaUseCase } from '../modules/agenda/application/use-cases/cita/CambiarEstadoCitaUseCase';
import { CancelCitaUseCase } from '../modules/agenda/application/use-cases/cita/CancelCitaUseCase';
import { CompletarCitaUseCase } from '../modules/agenda/application/use-cases/cita/CompletarCitaUseCase';

// Agenda Module — Use Cases (Bloqueos)
import { ListBloqueosUseCase } from '../modules/agenda/application/use-cases/bloqueo/ListBloqueosUseCase';
import { CreateBloqueoUseCase } from '../modules/agenda/application/use-cases/bloqueo/CreateBloqueoUseCase';
import { DeleteBloqueoUseCase } from '../modules/agenda/application/use-cases/bloqueo/DeleteBloqueoUseCase';

// Agenda Module — Use Cases (Horarios)
import { GetHorariosUseCase } from '../modules/agenda/application/use-cases/horario/GetHorariosUseCase';
import { UpsertHorariosUseCase } from '../modules/agenda/application/use-cases/horario/UpsertHorariosUseCase';

// Agenda Module — Controllers
import { CitaController } from '../modules/agenda/presentation/controllers/CitaController';
import { DisponibilidadController } from '../modules/agenda/presentation/controllers/DisponibilidadController';
import { BloqueoController } from '../modules/agenda/presentation/controllers/BloqueoController';
import { HorarioController } from '../modules/agenda/presentation/controllers/HorarioController';

// Catalogo Module — Controllers
import { CategoriaController } from '../modules/catalogo/presentation/controllers/CategoriaController';
import { ServicioController } from '../modules/catalogo/presentation/controllers/ServicioController';
import { ProductoController } from '../modules/catalogo/presentation/controllers/ProductoController';

// ---- DataSource ----
container.registerInstance('DataSource', AppDataSource);

// ---- Auth Module ----
container.register('IUsuarioRepository', { useClass: TypeORMUsuarioRepository });
container.register('IBcryptService', { useClass: BcryptService });
container.register('ITokenService', { useClass: JwtTokenService });

container.register(LoginUseCase, { useClass: LoginUseCase });
container.register(RefreshTokenUseCase, { useClass: RefreshTokenUseCase });
container.register(GetCurrentUserUseCase, { useClass: GetCurrentUserUseCase });
container.register(AuthController, { useClass: AuthController });

// ---- Salon Module ----
container.register('ISalonRepository', { useClass: TypeORMSalonRepository });
container.register(CreateSalonUseCase, { useClass: CreateSalonUseCase });
container.register(ListSalonesUseCase, { useClass: ListSalonesUseCase });
container.register(GetSalonByApiKeyUseCase, { useClass: GetSalonByApiKeyUseCase });
container.register(SalonSuperadminController, { useClass: SalonSuperadminController });
container.register(SalonN8nController, { useClass: SalonN8nController });

// ---- Catalogo Module — Repositories ----
container.register('ICategoriaServicioRepository', { useClass: TypeORMCategoriaServicioRepository });
container.register('IServicioRepository', { useClass: TypeORMServicioRepository });
container.register('IProductoRepository', { useClass: TypeORMProductoRepository });

// ---- Catalogo Module — Use Cases (Categorías) ----
container.register('ListCategoriasUseCase', { useClass: ListCategoriasUseCase });
container.register('CreateCategoriaUseCase', { useClass: CreateCategoriaUseCase });
container.register('UpdateCategoriaUseCase', { useClass: UpdateCategoriaUseCase });
container.register('DeleteCategoriaUseCase', { useClass: DeleteCategoriaUseCase });

// ---- Catalogo Module — Use Cases (Servicios) ----
container.register('ListServiciosUseCase', { useClass: ListServiciosUseCase });
container.register('GetServicioUseCase', { useClass: GetServicioUseCase });
container.register('CreateServicioUseCase', { useClass: CreateServicioUseCase });
container.register('UpdateServicioUseCase', { useClass: UpdateServicioUseCase });
container.register('DeleteServicioUseCase', { useClass: DeleteServicioUseCase });

// ---- Catalogo Module — Use Cases (Productos) ----
container.register('ListProductosUseCase', { useClass: ListProductosUseCase });
container.register('GetProductoUseCase', { useClass: GetProductoUseCase });
container.register('CreateProductoUseCase', { useClass: CreateProductoUseCase });
container.register('UpdateProductoUseCase', { useClass: UpdateProductoUseCase });
container.register('DescontarStockUseCase', { useClass: DescontarStockUseCase });
container.register('ReabastecerStockUseCase', { useClass: ReabastecerStockUseCase });
container.register('DeleteProductoUseCase', { useClass: DeleteProductoUseCase });

// ---- Catalogo Module — Controllers ----
container.register(CategoriaController, { useClass: CategoriaController });
container.register(ServicioController, { useClass: ServicioController });
container.register(ProductoController, { useClass: ProductoController });

// ---- Personas Module — Repositories ----
container.register('IPersonasUsuarioRepository', { useClass: PersonasTypeORMUsuarioRepository });
container.register('IClienteRepository', { useClass: TypeORMClienteRepository });

// ---- Personas Module — Use Cases (Empleadas) ----
container.register('ListEmpleadasUseCase', { useClass: ListEmpleadasUseCase });
container.register('GetEmpleadaUseCase', { useClass: GetEmpleadaUseCase });
container.register('CreateEmpleadaUseCase', { useClass: CreateEmpleadaUseCase });
container.register('UpdateEmpleadaUseCase', { useClass: UpdateEmpleadaUseCase });
container.register('ActivateEmpleadaUseCase', { useClass: ActivateEmpleadaUseCase });
container.register('DeactivateEmpleadaUseCase', { useClass: DeactivateEmpleadaUseCase });

// ---- Personas Module — Use Cases (Clientes) ----
container.register('ListClientesUseCase', { useClass: ListClientesUseCase });
container.register('GetClienteUseCase', { useClass: GetClienteUseCase });
container.register('CreateClienteUseCase', { useClass: CreateClienteUseCase });
container.register('UpdateClienteUseCase', { useClass: UpdateClienteUseCase });

// ---- Personas Module — Controllers ----
container.register(EmpleadaController, { useClass: EmpleadaController });
container.register(ClienteController, { useClass: ClienteController });

// ---- Agenda Module — Repositories ----
container.register('ICitaRepository', { useClass: TypeORMCitaRepository });
container.register('IBloqueoAgendaRepository', { useClass: TypeORMBloqueoAgendaRepository });
container.register('IHorarioComercialRepository', { useClass: TypeORMHorarioComercialRepository });

// ---- Agenda Module — Services ----
container.register(DisponibilidadService, { useClass: DisponibilidadService });

// ---- Agenda Module — Use Cases (Citas) ----
container.register('ListCitasUseCase', { useClass: ListCitasUseCase });
container.register('GetCitaUseCase', { useClass: GetCitaUseCase });
container.register('CreateCitaUseCase', { useClass: CreateCitaUseCase });
container.register('CambiarEstadoCitaUseCase', { useClass: CambiarEstadoCitaUseCase });
container.register('CancelCitaUseCase', { useClass: CancelCitaUseCase });
container.register('CompletarCitaUseCase', { useClass: CompletarCitaUseCase });

// ---- Agenda Module — Use Cases (Bloqueos) ----
container.register('ListBloqueosUseCase', { useClass: ListBloqueosUseCase });
container.register('CreateBloqueoUseCase', { useClass: CreateBloqueoUseCase });
container.register('DeleteBloqueoUseCase', { useClass: DeleteBloqueoUseCase });

// ---- Agenda Module — Use Cases (Horarios) ----
container.register('GetHorariosUseCase', { useClass: GetHorariosUseCase });
container.register('UpsertHorariosUseCase', { useClass: UpsertHorariosUseCase });

// ---- Agenda Module — Controllers ----
container.register(CitaController, { useClass: CitaController });
container.register(DisponibilidadController, { useClass: DisponibilidadController });
container.register(BloqueoController, { useClass: BloqueoController });
container.register(HorarioController, { useClass: HorarioController });

// ---- Finanzas Module — Repositories ----
import { TypeORMRegistroServicioRepository } from '../modules/finanzas/infrastructure/persistence/TypeORMRegistroServicioRepository';
import { TypeORMPagoTransaccionRepository } from '../modules/finanzas/infrastructure/persistence/TypeORMPagoTransaccionRepository';
import { TypeORMDivisionRegistroRepository } from '../modules/finanzas/infrastructure/persistence/TypeORMDivisionRegistroRepository';
import { TypeORMLiquidacionRepository } from '../modules/finanzas/infrastructure/persistence/TypeORMLiquidacionRepository';
import { TypeORMGastoRepository } from '../modules/finanzas/infrastructure/persistence/TypeORMGastoRepository';
import { TypeORMDevolucionRepository } from '../modules/finanzas/infrastructure/persistence/TypeORMDevolucionRepository';

// Planes Module
import { TypeORMPlanRepository } from '../modules/planes/infrastructure/repositories/TypeORMPlanRepository';
import { ListPlanesUseCase } from '../modules/planes/application/use-cases/ListPlanesUseCase';
import { GetPlanByIdUseCase } from '../modules/planes/application/use-cases/GetPlanByIdUseCase';
import { CreatePlanUseCase } from '../modules/planes/application/use-cases/CreatePlanUseCase';
import { UpdatePlanUseCase } from '../modules/planes/application/use-cases/UpdatePlanUseCase';
import { DeletePlanUseCase } from '../modules/planes/application/use-cases/DeletePlanUseCase';
import { ComisionService } from '../modules/finanzas/application/services/ComisionService';

// ---- Finanzas Module — Use Cases (Registros) ----
import { CreateRegistroUseCase } from '../modules/finanzas/application/use-cases/registro/CreateRegistroUseCase';
import { ListRegistrosUseCase } from '../modules/finanzas/application/use-cases/registro/ListRegistrosUseCase';
import { GetRegistroUseCase } from '../modules/finanzas/application/use-cases/registro/GetRegistroUseCase';
import { AnularRegistroUseCase } from '../modules/finanzas/application/use-cases/registro/AnularRegistroUseCase';

// ---- Finanzas Module — Use Cases (Gastos) ----
import { ListGastosUseCase } from '../modules/finanzas/application/use-cases/gasto/ListGastosUseCase';
import { CreateGastoUseCase } from '../modules/finanzas/application/use-cases/gasto/CreateGastoUseCase';
import { DeleteGastoUseCase } from '../modules/finanzas/application/use-cases/gasto/DeleteGastoUseCase';

// ---- Finanzas Module — Use Cases (Devoluciones) ----
import { ListDevolucionesUseCase } from '../modules/finanzas/application/use-cases/devolucion/ListDevolucionesUseCase';
import { CreateDevolucionUseCase } from '../modules/finanzas/application/use-cases/devolucion/CreateDevolucionUseCase';

// ---- Finanzas Module — Use Cases (Liquidación) ----
import { NominaPendienteUseCase } from '../modules/finanzas/application/use-cases/liquidacion/NominaPendienteUseCase';
import { LiquidarEmpleadaUseCase } from '../modules/finanzas/application/use-cases/liquidacion/LiquidarEmpleadaUseCase';
import { HistorialLiquidacionesUseCase } from '../modules/finanzas/application/use-cases/liquidacion/HistorialLiquidacionesUseCase';

// ---- Finanzas Module — Use Cases (Reportes) ----
import { ResumenDiaUseCase } from '../modules/finanzas/application/use-cases/reporte/ResumenDiaUseCase';
import { ROIMensualUseCase } from '../modules/finanzas/application/use-cases/reporte/ROIMensualUseCase';
import { CierreTurnoUseCase } from '../modules/finanzas/application/use-cases/reporte/CierreTurnoUseCase';

// ---- Finanzas Module — Controllers ----
import { RegistroController } from '../modules/finanzas/presentation/controllers/RegistroController';
import { GastoController } from '../modules/finanzas/presentation/controllers/GastoController';
import { DevolucionController } from '../modules/finanzas/presentation/controllers/DevolucionController';
import { LiquidacionController } from '../modules/finanzas/presentation/controllers/LiquidacionController';
import { ReporteController } from '../modules/finanzas/presentation/controllers/ReporteController';

// ---- Finanzas Module — DI ----
container.register('IRegistroServicioRepository', { useClass: TypeORMRegistroServicioRepository });
container.register('IPagoTransaccionRepository', { useClass: TypeORMPagoTransaccionRepository });
container.register('IDivisionRegistroRepository', { useClass: TypeORMDivisionRegistroRepository });
container.register('ILiquidacionRepository', { useClass: TypeORMLiquidacionRepository });
container.register('IGastoRepository', { useClass: TypeORMGastoRepository });
container.register('IDevolucionRepository', { useClass: TypeORMDevolucionRepository });
container.register(ComisionService, { useClass: ComisionService });

// ---- Finanzas Module — Use Cases (Registros) ----
container.register(CreateRegistroUseCase, { useClass: CreateRegistroUseCase });
container.register(ListRegistrosUseCase, { useClass: ListRegistrosUseCase });
container.register(GetRegistroUseCase, { useClass: GetRegistroUseCase });
container.register(AnularRegistroUseCase, { useClass: AnularRegistroUseCase });

// ---- Finanzas Module — Use Cases (Gastos) ----
container.register(ListGastosUseCase, { useClass: ListGastosUseCase });
container.register(CreateGastoUseCase, { useClass: CreateGastoUseCase });
container.register(DeleteGastoUseCase, { useClass: DeleteGastoUseCase });

// ---- Finanzas Module — Use Cases (Devoluciones) ----
container.register(ListDevolucionesUseCase, { useClass: ListDevolucionesUseCase });
container.register(CreateDevolucionUseCase, { useClass: CreateDevolucionUseCase });

// ---- Finanzas Module — Use Cases (Liquidación) ----
container.register(NominaPendienteUseCase, { useClass: NominaPendienteUseCase });
container.register(LiquidarEmpleadaUseCase, { useClass: LiquidarEmpleadaUseCase });
container.register(HistorialLiquidacionesUseCase, { useClass: HistorialLiquidacionesUseCase });

// ---- Finanzas Module — Use Cases (Reportes) ----
container.register(ResumenDiaUseCase, { useClass: ResumenDiaUseCase });
container.register(ROIMensualUseCase, { useClass: ROIMensualUseCase });
container.register(CierreTurnoUseCase, { useClass: CierreTurnoUseCase });

// ---- Finanzas Module — Controllers ----
container.register(RegistroController, { useClass: RegistroController });
container.register(GastoController, { useClass: GastoController });
container.register(DevolucionController, { useClass: DevolucionController });
container.register(LiquidacionController, { useClass: LiquidacionController });
container.register(ReporteController, { useClass: ReporteController });

// ---- Planes Module ----
container.register('IPlanRepository', { useClass: TypeORMPlanRepository });
container.register(ListPlanesUseCase, { useClass: ListPlanesUseCase });
container.register(GetPlanByIdUseCase, { useClass: GetPlanByIdUseCase });
container.register(CreatePlanUseCase, { useClass: CreatePlanUseCase });
container.register(UpdatePlanUseCase, { useClass: UpdatePlanUseCase });
container.register(DeletePlanUseCase, { useClass: DeletePlanUseCase });

export { container };
