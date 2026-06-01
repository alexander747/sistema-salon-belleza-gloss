# Entity Layer Specification

## Purpose

Define the 18 TypeORM entities migrated from pos-ok, including the new BaseEntity, Rol enum, Bitacora audit trail, and Salon branding fields.

## Requirements

### Requirement: BaseEntity

Every entity MUST extend a `BaseEntity` abstract class with `id: number` (PK), `creadoEn: Date` (`@CreateDateColumn`), and `actualizadoEn: Date` (`@UpdateDateColumn`).

#### Scenario: BaseEntity columns present

- GIVEN any entity (e.g., Usuario, Salon)
- WHEN inspecting its database table
- THEN columns `id`, `creadoEn`, and `actualizadoEn` exist

#### Scenario: Timestamps auto-set

- GIVEN a new entity record is inserted
- WHEN querying it immediately after save
- THEN `creadoEn` is set to the insertion timestamp
- AND `actualizadoEn` matches `creadoEn` on creation and updates on modification

### Requirement: Usuario with Rol Enum

The Usuario entity MUST replace boolean role flags (`esManicurista`, `esRecepcionista`, `esDuena`) with a single `rol: Rol` numeric enum column (1=SUPERADMIN, 2=DUEÑA, 3=ADMINISTRADOR, 4=MANICURISTA, 5=RECEPCIONISTA). It MUST also include: `passwordHash`, `avatar`, `fechaNacimiento`, `porcentajeComisionServicio`, `sueldoFijo`, `bonoHorario`, `frecuenciaBono`.

#### Scenario: Rol enum replaces booleans

- GIVEN the usuarios table schema
- WHEN inspecting columns
- THEN `rol` (int/enum) exists
- AND `esManicurista`, `esRecepcionista`, `esDuena` do NOT exist

#### Scenario: Multiple roles via mapping table

- GIVEN a user who is both manicurista and recepcionista
- WHEN multiple role records are associated
- THEN the system supports compound roles (separate roles table or mapping)

### Requirement: Bitacora Audit Entity

The system MUST have a `Bitacora` entity with fields: `nivel`, `metodo`, `url`, `accion`, `mensaje`, `requestData` (JSON), `responseData` (JSON), `statusCode`, `stackTrace`, `datosExtra` (JSON), `salonId`, `usuarioId`, `nombreSalon`, `nombreUsuario`.

#### Scenario: Bitacora records API request

- GIVEN any API request to the backend
- WHEN the request middleware executes
- THEN a Bitacora record is created with `url`, `metodo`, `statusCode`, and `salonId`

#### Scenario: Bitacora captures errors

- GIVEN a request that throws a 500 error
- WHEN the global error handler runs
- THEN the Bitacora record includes `stackTrace` and `nivel: 'ERROR'`

### Requirement: Salon Branding Fields

The Salon entity MUST include branding fields: `logoUrl` (string, nullable), `colorPrimario` (string, nullable), `colorSecundario` (string, nullable), and `tema` (string, nullable).

#### Scenario: Branding fields exist on salon

- GIVEN the salones table schema
- WHEN inspecting columns
- THEN `logoUrl`, `colorPrimario`, `colorSecundario`, and `tema` are present and nullable

#### Scenario: Frontend consumes branding

- GIVEN a logged-in user
- WHEN `GET /api/auth/me` is called
- THEN the response includes `salon.logoUrl`, `colorPrimario`, `colorSecundario`, and `tema`

### Requirement: Migrated Entity Set

The system MUST migrate all 18 entities from pos-ok: Salon, Usuario, Cliente, CategoriaServicio, Servicio, Producto, Cita, RegistroServicio, PagoTransaccion, Gasto, Devolucion, FotoPortafolio, HorarioComercial, BloqueoAgenda, Liquidacion, CampanaMarketing, Notificacion, RecompensaFidelidad, DivisionRegistro, plus the new Bitacora and Membresia.

#### Scenario: All entities have TypeORM decorators

- GIVEN each entity file
- WHEN compiling
- THEN each file has `@Entity()` decorator with correct table name
- AND all column decorators match the pos-ok schema with updates

#### Scenario: Foreign keys match pos-ok

- GIVEN each entity's relationships
- WHEN comparing to pos-ok
- THEN `@ManyToOne` and `@OneToMany` relations with `salonId` exist on every tenant-scoped entity
