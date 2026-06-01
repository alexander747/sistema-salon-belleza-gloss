# Design: Fundación Arquitectónica

## Technical Approach

Monorepo (Turborepo + pnpm) with hexagonal backend (Express/TypeORM/MySQL) and two thin React frontends (Superadmin Portal + POS Dashboard). The backend is modular by bounded context, each module with 4 layers: `domain`, `application`, `infrastructure`, `presentation`. Domain defines pure entities and repository interfaces. Application orchestrates use cases with Zod-validated DTOs. Infrastructure provides TypeORM persistence and DI registrations. Presentation exposes thin Express controllers. Auth is JWT-based with refresh token rotation, API key for n8n routes, and role-based guards. Shared packages: `@pos-final/types`, `@pos-final/validation`, `@pos-final/ui`, `@pos-final/config`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Turborepo vs npm workspaces | Turborepo adds caching/pipelines but steeper learning curve | **Turborepo** — 3 apps + 4 packages benefit from build caching |
| pnpm vs npm | pnpm faster/stricter, npm universal | **pnpm** — strict resolution prevents phantom deps in monorepo |
| TypeORM vs Drizzle | TypeORM heavier, Drizzle lighter but migration tooling less mature | **TypeORM** — migration CLI, decorators, existing pos-ok entities as baseline |
| Hexagonal per-module vs flat layers | Per-module has more dirs; flat layers couples modules | **Per-module hexagonal** — bounded contexts isolate independently |
| Pino vs Winston | Pino faster JSON, Winston more ecosystem | **Pino** — structured JSON logging, lower overhead |
| synchronize: false + migrations from day 1 | Slower initial setup but safe for production | **Migrations from day 1** — no DDL drift risk |

## Exact File Tree

```
pos-final/
├── package.json                          # Root workspace config (pnpm workspaces + scripts)
├── turbo.json                            # Turborepo pipeline (build, test, lint, dev)
├── tsconfig.base.json                    # Shared TS strict config (ES2022, NodeNext)
├── pnpm-workspace.yaml                   # Workspace packages: apps/*, packages/*
├── .eslintrc.js                          # Shared ESLint flat config
├── .prettierrc                           # Shared Prettier: singleQuote, trailingComma
├── .gitignore                            # node_modules, dist, .env, *.log
├── docker-compose.yml                    # MySQL 8 + n8n services
├── docker/
│   └── mysql/
│       └── init.sql                      # CREATE DATABASE + charset
├── packages/
│   ├── config/                           # @pos-final/config
│   │   ├── package.json
│   │   ├── tsconfig.base.json            # Strict, ES2022, NodeNext, experimentalDecorators
│   │   ├── vitest.base.config.ts         # Shared Vitest config (globals: true, Supertest)
│   │   └── eslint.config.js              # Flat ESLint: TS strict, import ordering
│   ├── types/                            # @pos-final/types
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                  # Re-exports all
│   │       ├── enums/
│   │       │   ├── Rol.ts                # { SUPERADMIN=1, DUENIA=2, ADMINISTRADOR=3, MANICURISTA=4, RECEPCIONISTA=5, CONTADOR=6 }
│   │       │   ├── EstadoCita.ts         # { PENDIENTE, CONFIRMADA, COMPLETADA, CANCELADA, NO_LLEGO }
│   │       │   ├── MetodoPago.ts         # { EFECTIVO, TRANSFERENCIA, TARJETA }
│   │       │   ├── TipoInventario.ts     # { RETAIL, INTERNAL }
│   │       │   ├── TipoBloqueo.ts        # From pos-ok
│   │       │   └── Plan.ts               # { BASIC, PREMIUM } — new
│   │       └── dto/
│   │           ├── LoginDto.ts            # { email: string, password: string }
│   │           ├── CreateSalonDto.ts      # { nombre, numeroWhatsApp, nombreBot }
│   │           ├── CreateUsuarioDto.ts    # Create user fields
│   │           ├── RefreshTokenDto.ts     # { refreshToken: string }
│   │           └── ApiResponse.ts         # Generic { ok: boolean, data?: T, error?: { code, message, details } }
│   ├── validation/                       # @pos-final/validation
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                  # Re-exports all Zod schemas
│   │       ├── auth.schema.ts            # loginSchema, refreshSchema, createUsuarioSchema
│   │       ├── salon.schema.ts           # createSalonSchema
│   │       └── common.schema.ts          # idParamSchema, paginationSchema
│   └── ui/                               # @pos-final/ui
│       ├── package.json
│       └── src/
│           ├── index.ts                  # Re-exports all components
│           ├── components/
│           │   ├── Button.tsx
│           │   ├── Input.tsx
│           │   ├── Card.tsx
│           │   ├── Modal.tsx
│           │   ├── Table.tsx
│           │   ├── Badge.tsx
│           │   ├── Toast.tsx
│           │   ├── Spinner.tsx
│           │   └── Avatar.tsx
│           └── layouts/
│               ├── Sidebar.tsx
│               ├── Header.tsx
│               └── PageContainer.tsx
├── apps/
│   ├── backend/                          # @pos-final/backend
│   │   ├── package.json
│   │   ├── tsconfig.json                 # Extends @pos-final/config/tsconfig.base.json
│   │   ├── vitest.config.ts              # Extends base + Supertest setup
│   │   └── src/
│   │       ├── server.ts                 # listen() on PORT
│   │       ├── app.ts                    # createApp(): Express instance with middleware chain
│   │       ├── config/
│   │       │   ├── env.ts                # dotenv + Zod-validated env schema
│   │       │   └── database.ts           # TypeORM DataSource singleton
│   │       ├── shared/
│   │       │   ├── errors/
│   │       │   │   ├── AppError.ts       # Base error class: code, message, statusCode
│   │       │   │   ├── NotFoundError.ts
│   │       │   │   ├── UnauthorizedError.ts
│   │       │   │   ├── ForbiddenError.ts
│   │       │   │   └── ValidationError.ts
│   │       │   ├── types/
│   │       │   │   └── express.d.ts      # Express Request extension: user, salonId
│   │       │   ├── logger.ts             # Pino logger with correlation IDs
│   │       │   └── container.ts          # tsyringe DI container: registers all interfaces → implementations
│   │       ├── middleware/
│   │       │   ├── authGuard.ts          # Extracts JWT from Bearer, sets req.user
│   │       │   ├── apiKeyGuard.ts        # Validates X-API-Key for n8n routes
│   │       │   ├── tenantGuard.ts        # Sets req.salonId from JWT or API key lookup
│   │       │   ├── requireRole.ts        # requireRole('DUEÑA', 'ADMINISTRADOR'): returns middleware
│   │       │   ├── validate.ts           # validate(schema): validates req.body/params/query via Zod
│   │       │   ├── errorHandler.ts       # Global catch: maps AppError → JSON, unknown → 500
│   │       │   └── requestLogger.ts      # Async fire-and-forget Bitacora write
│   │       ├── database/
│   │       │   ├── migrations/
│   │       │   │   └── 1716937200000-InitialSchema.ts  # Creates all 21 tables
│   │       │   ├── seed.ts               # Creates SUPERADMIN, default Rol values, test salon
│   │       │   └── entities/             # TypeORM entities (with decorators — infrastructure layer)
│   │       │       ├── BaseEntity.ts     # Abstract: @PrimaryGeneratedColumn id, @CreateDateColumn, @UpdateDateColumn
│   │       │       ├── SalonEntity.ts
│   │       │       ├── UsuarioEntity.ts
│   │       │       ├── ClienteEntity.ts
│   │       │       ├── CategoriaServicioEntity.ts
│   │       │       ├── ServicioEntity.ts
│   │       │       ├── ProductoEntity.ts
│   │       │       ├── CitaEntity.ts
│   │       │       ├── RegistroServicioEntity.ts
│   │       │       ├── PagoTransaccionEntity.ts
│   │       │       ├── GastoEntity.ts
│   │       │       ├── DevolucionEntity.ts
│   │       │       ├── FotoPortafolioEntity.ts
│   │       │       ├── HorarioComercialEntity.ts
│   │       │       ├── BloqueoAgendaEntity.ts
│   │       │       ├── LiquidacionEntity.ts
│   │       │       ├── CampanaMarketingEntity.ts
│   │       │       ├── NotificacionEntity.ts
│   │       │       ├── RecompensaFidelidadEntity.ts
│   │       │       ├── DivisionRegistroEntity.ts
│   │       │       ├── BitacoraEntity.ts
│   │       │       └── MembresiaEntity.ts
│   │       └── modules/
│   │           ├── auth/
│   │           │   ├── domain/
│   │           │   │   └── ports/
│   │           │   │       ├── IUsuarioRepository.ts    # findById, findByEmail, findByPhone
│   │           │   │       └── ITokenService.ts         # generateAccessToken, generateRefreshToken, verify
│   │           │   ├── application/
│   │           │   │   ├── use-cases/
│   │           │   │   │   ├── LoginUseCase.ts          # email+password → tokens
│   │           │   │   │   ├── RefreshTokenUseCase.ts   # refresh token rotation
│   │           │   │   │   └── GetProfileUseCase.ts     # JWT claims → user + salon
│   │           │   │   └── dto/
│   │           │   │       ├── LoginInput.ts
│   │           │   │       └── AuthOutput.ts            # { accessToken, refreshToken, user }
│   │           │   ├── infrastructure/
│   │           │   │   ├── repositories/
│   │           │   │   │   └── TypeORMUsuarioRepository.ts
│   │           │   │   ├── services/
│   │           │   │   │   ├── JwtTokenService.ts       # jsonwebtoken sign/verify, refresh token storage
│   │           │   │   │   └── BcryptService.ts         # bcrypt hash/compare
│   │           │   │   └── di/
│   │           │   │       └── auth.di.ts               # container.register tokens for auth module
│   │           │   └── presentation/
│   │           │       ├── controllers/
│   │           │       │   └── AuthController.ts
│   │           │       └── routes/
│   │           │           └── auth.routes.ts           # POST /login, POST /refresh, GET /me
│   │           ├── salon/
│   │           │   ├── domain/
│   │           │   │   └── ports/
│   │           │   │       └── ISalonRepository.ts       # findById, findAll, create, findByApiKey
│   │           │   ├── application/
│   │           │   │   ├── use-cases/
│   │           │   │   │   ├── CreateSalonUseCase.ts
│   │           │   │   │   ├── ListSalonesUseCase.ts
│   │           │   │   │   └── GetSalonByApiKeyUseCase.ts
│   │           │   │   └── dto/
│   │           │   │       └── SalonDto.ts
│   │           │   ├── infrastructure/
│   │           │   │   ├── repositories/
│   │           │   │   │   └── TypeORMSalonRepository.ts
│   │           │   │   └── di/
│   │           │   │       └── salon.di.ts
│   │           │   └── presentation/
│   │           │       ├── controllers/
│   │           │       │   ├── SalonSuperadminController.ts  # POST/GET /superadmin/salones
│   │           │       │   └── SalonN8nController.ts         # GET /n8n/:salonId/salon
│   │           │       └── routes/
│   │           │           ├── superadmin.routes.ts
│   │           │           └── n8n.routes.ts
│   │           ├── usuarios/
│   │           │   ├── domain/ports/IUsuarioRepository.ts
│   │           │   ├── application/use-cases/CreateUsuarioUseCase.ts
│   │           │   ├── infrastructure/repositories/TypeORMUsuarioRepo.ts
│   │           │   └── presentation/...  # Stub: controllers for future use
│   │           └── (remaining 8 modules stubbed with domain/ports only)
│   ├── dashboard/                        # @pos-final/dashboard (POS for salon staff)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx                  # ReactDOM + providers
│   │       ├── App.tsx                   # React Router: /login → LoginPage, /* → ShellLayout
│   │       ├── providers/
│   │       │   ├── AuthProvider.tsx       # Auth context: user, login, logout, refresh
│   │       │   └── QueryProvider.tsx      # React Query client (stub)
│   │       ├── services/
│   │       │   └── api.ts                # Axios instance with interceptor for JWT refresh
│   │       ├── pages/
│   │       │   ├── LoginPage.tsx
│   │       │   └── DashboardPage.tsx     # Empty shell: "Bienvenida al POS"
│   │       └── styles/
│   │           └── globals.css
│   └── superadmin/                       # @pos-final/superadmin (tenant management)
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                   # React Router: / → redirect to /login, /login, /salones
│           ├── providers/
│           │   ├── AuthProvider.tsx
│           │   └── QueryProvider.tsx
│           ├── services/
│           │   └── api.ts
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── DashboardPage.tsx     # Empty shell: "Panel Superadmin"
│           │   └── SalonListPage.tsx     # Table of salons + create form
│           └── styles/
│               └── globals.css
```

## Key Interfaces (real TypeScript)

### Domain Ports

```typescript
// packages/types/src/enums/Rol.ts
export enum Rol {
  SUPERADMIN = 1,
  DUENIA = 2,
  ADMINISTRADOR = 3,
  MANICURISTA = 4,
  RECEPCIONISTA = 5,
  CONTADOR = 6,
}

// apps/backend/src/modules/auth/domain/ports/ITokenService.ts
export interface ITokenService {
  generateAccessToken(payload: { sub: number; salonId: number; rol: Rol }): string;
  generateRefreshToken(userId: number): Promise<string>;
  verifyAccessToken(token: string): { sub: number; salonId: number; rol: Rol };
  verifyRefreshToken(token: string): Promise<{ userId: number; tokenFamily: string }>;
  invalidateTokenFamily(userId: number): Promise<void>;
}

// apps/backend/src/modules/salon/domain/ports/ISalonRepository.ts
export interface ISalonRepository {
  findById(id: number): Promise<SalonEntity | null>;
  findAll(): Promise<SalonEntity[]>;
  create(salon: Omit<SalonEntity, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<SalonEntity>;
  findByApiKey(apiKey: string): Promise<SalonEntity | null>;
}
```

### BaseEntity

```typescript
// apps/backend/src/database/entities/BaseEntity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
```

### SalonEntity (new fields bolded)

```typescript
@Entity('salones')
export class SalonEntity extends BaseEntity {
  @Column({ length: 150 })
  nombre: string;

  @Column({ length: 20, unique: true })
  numeroWhatsApp: string;

  @Column({ length: 100, default: 'Asistente Virtual' })
  nombreBot: string;

  @Column({ length: 20, default: 'amigable' })
  tonoVoz: string;

  @Column({ type: 'enum', enum: Plan, default: Plan.BASIC })
  plan: Plan;                            // NEW

  @Column({
    type: 'enum',
    enum: ['ACTIVO', 'SUSPENDIDO'],
    default: 'ACTIVO'
  })
  estado: string;                        // NEW

  @Column({ length: 64, unique: true })
  apiKeyN8n: string;                     // NEW — crypto.randomBytes(32).toString('hex')

  @Column({ length: 500, nullable: true })
  logoUrl: string;

  @Column({ length: 7, nullable: true })
  colorPrimario: string;                 // NEW — hex color

  @Column({ length: 7, nullable: true })
  colorSecundario: string;               // NEW — hex color

  @Column({ length: 50, nullable: true })
  tema: string;                          // NEW — 'claro' | 'oscuro'

  @Column({ type: 'json', nullable: true })
  faqBase: object;

  @Column({ type: 'json', nullable: true })
  redesSociales: object;

  @Column({ default: 24 })
  horasCancelacion: number;

  @Column({ type: 'json', nullable: true })
  reglasTemporada: object;
}
```

### UsuarioEntity (migrated roles + new fields)

```typescript
@Entity('usuarios')
export class UsuarioEntity extends BaseEntity {
  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 20 })
  numeroWhatsApp: string;

  @Column({ length: 200 })
  email: string;

  @Column({ length: 200, nullable: true })
  passwordHash: string;

  @Column({ length: 255, nullable: true })
  avatar: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ type: 'int', default: Rol.DUENIA })  // REPLACES boolean flags
  rol: Rol;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  porcentajeComisionServicio: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sueldoFijo: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  bonoHorario: number;

  @Column({ length: 20, nullable: true })
  frecuenciaBono: string;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null;           // NEW — hashed refresh token

  @Column({ length: 36, nullable: true })
  refreshTokenFamily: string | null;     // NEW — UUID for token family

  @ManyToOne(() => SalonEntity, s => s.usuarios)
  @JoinColumn({ name: 'salonId' })
  salon: SalonEntity;

  @Column()
  salonId: number;
}
```

## Middleware Chain (exact order in app.ts)

```typescript
// apps/backend/src/app.ts
import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyGuard } from './middleware/apiKeyGuard';
import { tenantGuard } from './middleware/tenantGuard';
import { authGuard } from './middleware/authGuard';
import { n8nRouter } from './modules/salon/presentation/routes/n8n.routes';
import { authRouter } from './modules/auth/presentation/routes/auth.routes';
import { superadminRouter } from './modules/salon/presentation/routes/superadmin.routes';

export function createApp(): express.Application {
  const app = express();

  // 1. Security & parsing (order matters)
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(',') })); // ['http://localhost:5173','http://localhost:5174']
  app.use(express.json({ limit: '1mb' }));

  // 2. Request logger — fires on EVERY request, non-blocking
  app.use(requestLogger);

  // 3. Health — public, no auth
  app.get('/api/salud', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // 4. n8n routes — API key auth, no JWT
  app.use('/api/n8n', apiKeyGuard, tenantGuard, n8nRouter);

  // 5. Protected routes — JWT required
  app.use('/api', authGuard, tenantGuard);

  // 5a. Auth routes (no tenant for /login)
  app.use('/api/auth', authRouter);

  // 5b. Superadmin routes (role-guarded)
  app.use('/api/superadmin', superadminRouter);

  // 6. Global error handler — MUST be last
  app.use(errorHandler);

  return app;
}
```

## Dependency Injection Container

```typescript
// apps/backend/src/shared/container.ts
import { container } from 'tsyringe';
import { AppDataSource } from '../config/database';
import { TypeORMSalonRepository } from '../modules/salon/infrastructure/repositories/TypeORMSalonRepository';
import { TypeORMUsuarioRepository } from '../modules/auth/infrastructure/repositories/TypeORMUsuarioRepository';
import { JwtTokenService } from '../modules/auth/infrastructure/services/JwtTokenService';
import { BcryptService } from '../modules/auth/infrastructure/services/BcryptService';

// Singleton DataSource — registered once
container.register('DataSource', { useValue: AppDataSource });

// Repository implementations
container.register('ISalonRepository', { useClass: TypeORMSalonRepository });
container.register('IUsuarioRepository', { useClass: TypeORMUsuarioRepository });

// Service implementations
container.register('ITokenService', { useClass: JwtTokenService });

// BcryptService is value-type (no state) — singleton
container.register('IBcryptService', { useClass: BcryptService });

// Use cases and controllers are auto-resolved via @injectable() decorator + constructor injection
// Controllers registered via their class tokens
container.register('AuthController', { useClass: AuthController });
container.register('SalonSuperadminController', { useClass: SalonSuperadminController });
container.register('SalonN8nController', { useClass: SalonN8nController });
```

## Database Design

### DataSource Configuration

```typescript
// apps/backend/src/config/database.ts
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT) ?? 3306,
  username: process.env.DB_USERNAME ?? 'posfinal',
  password: process.env.DB_PASSWORD ?? 'posfinal',
  database: process.env.DB_DATABASE ?? 'posfinal',
  synchronize: false,                          // NEVER auto-sync
  migrationsRun: process.env.NODE_ENV === 'production',
  logging: process.env.NODE_ENV !== 'production',
  entities: [__dirname + '/../database/entities/**/*.ts'],   // DEV
  // entities: [__dirname + '/../database/entities/**/*.js'], // PROD (compiled)
  migrations: [__dirname + '/../database/migrations/**/*.ts'],
});
```

### Migration Generation Workflow

```bash
# After entity changes, generate migration:
pnpm --filter @pos-final/backend typeorm migration:generate -d src/config/database.ts src/database/migrations/AddNuevoCampo

# Apply:
pnpm --filter @pos-final/backend typeorm migration:run -d src/config/database.ts

# Rollback:
pnpm --filter @pos-final/backend typeorm migration:revert -d src/config/database.ts
```

### Seed Script Outline (`database/seed.ts`)

```typescript
import { AppDataSource } from '../config/database';
import { SalonEntity } from './entities/SalonEntity';
import { UsuarioEntity } from './entities/UsuarioEntity';
import { Rol } from '@pos-final/types';
import bcrypt from 'bcrypt';

async function seed() {
  await AppDataSource.initialize();

  // Create SUPERADMIN user (salonId=0 — system user, no tenant)
  const repo = AppDataSource.getRepository(UsuarioEntity);
  const exists = await repo.findOneBy({ email: 'admin@posfinal.app' });
  if (!exists) {
    const hash = await bcrypt.hash('admin123', 12);
    await repo.save({
      nombre: 'Superadmin',
      email: 'admin@posfinal.app',
      passwordHash: hash,
      rol: Rol.SUPERADMIN,
      salonId: 0,               // System user — no salon
      numeroWhatsApp: '0000000000',
    });
    console.log('✓ Superadmin seeded: admin@posfinal.app / admin123');
  }

  await AppDataSource.destroy();
}
seed().catch(console.error);
```

## Package Dependencies

### Root (`package.json`)

```json
{
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write '**/*.{ts,tsx,json}'"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.4.0"
  }
}
```

### Backend (`apps/backend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.19.0 | HTTP server |
| `cors` | ^2.8.5 | CORS middleware |
| `helmet` | ^7.1.0 | Security headers |
| `typeorm` | ^0.3.20 | ORM + migrations |
| `mysql2` | ^3.9.0 | MySQL driver |
| `jsonwebtoken` | ^9.0.0 | JWT sign/verify |
| `bcrypt` | ^5.1.0 | Password hashing |
| `zod` | ^3.23.0 | Request validation |
| `tsyringe` | ^4.8.0 | Dependency injection |
| `pino` | ^9.0.0 | Structured logging |
| `pino-pretty` | ^11.0.0 | Dev log formatting |
| `reflect-metadata` | ^0.2.0 | tsyringe dependency |
| `dotenv` | ^16.4.0 | Env loading |
| `@pos-final/types` | workspace:* | Shared types |
| `@pos-final/validation` | workspace:* | Shared schemas |

Dev deps: `vitest ^1.6.0`, `supertest ^7.0.0`, `@types/*`

### Frontends (`apps/dashboard/`, `apps/superadmin/`)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.0 | UI library |
| `react-dom` | ^18.3.0 | DOM renderer |
| `react-router-dom` | ^6.23.0 | Routing |
| `axios` | ^1.7.0 | HTTP client |
| `@pos-final/ui` | workspace:* | Shared components |
| `@pos-final/types` | workspace:* | Shared types |
| `@pos-final/validation` | workspace:* | Zod schemas |
| `vite` | ^5.4.0 | Build tool |
| `@vitejs/plugin-react` | ^4.3.0 | React Fast Refresh |

## Implementation Order (dependency-aware)

1. **Root configs**: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.prettierrc`
2. **`packages/config/`**: `package.json`, `tsconfig.base.json`, `vitest.base.config.ts`, `eslint.config.js`
3. **`packages/types/`**: `package.json`, all enums and DTOs (`Rol.ts`, `Plan.ts`, `EstadoCita.ts`, `MetodoPago.ts`, `TipoInventario.ts`, `ApiResponse.ts`, `LoginDto.ts`, `CreateSalonDto.ts`, etc.)
4. **`packages/validation/`**: `package.json`, Zod schemas for auth, salon
5. **`packages/ui/`**: `package.json`, stub `index.ts` (empty re-export)
6. **`apps/backend/` scaffold**: `package.json`, `tsconfig.json`, `vitest.config.ts`
7. **Backend shared**: `env.ts`, `logger.ts`, `AppError.ts` + subclasses, `express.d.ts`
8. **Database layer**: `BaseEntity.ts`, all 21 TypeORM entities, `database.ts` (DataSource), `migrations/InitialSchema.ts`, `seed.ts`
9. **Auth module — infrastructure first**: `BcryptService.ts`, `JwtTokenService.ts`, `TypeORMUsuarioRepository.ts`
10. **Auth module — application**: `LoginUseCase.ts`, `RefreshTokenUseCase.ts`, `GetProfileUseCase.ts`
11. **Auth module — presentation**: `AuthController.ts`, `auth.routes.ts`
12. **Salon module — infrastructure**: `TypeORMSalonRepository.ts`
13. **Salon module — application**: `CreateSalonUseCase.ts`, `ListSalonesUseCase.ts`, `GetSalonByApiKeyUseCase.ts`
14. **Salon module — presentation**: `SalonSuperadminController.ts`, `SalonN8nController.ts`, `superadmin.routes.ts`, `n8n.routes.ts`
15. **Middleware**: `authGuard.ts`, `apiKeyGuard.ts`, `tenantGuard.ts`, `requireRole.ts`, `validate.ts`, `errorHandler.ts`, `requestLogger.ts`
16. **Backend assembly**: `app.ts`, `server.ts`, `container.ts`
17. **Docker**: `docker-compose.yml`, `docker/mysql/init.sql`
18. **Frontend scaffolds**: `apps/superadmin/` full skeleton (login + salon list), `apps/dashboard/` skeleton (login + empty shell)
19. **Root verify**: `pnpm install`, `pnpm build`, `pnpm test`, `ESLint`

## Testing Strategy

| Layer | What | Tool |
|-------|------|------|
| Domain entities | Constructor, value objects | Vitest unit |
| Use cases | Mocked repositories — business logic isolation | Vitest + ts-mockito |
| Repositories | TypeORM with SQLite in-memory (or MySQL test DB) | Vitest + TypeORM |
| Controllers | Supertest against Express app with mocked use cases | Vitest + Supertest |
| Middleware | Supertest — auth, validation, error handler integration | Vitest + Supertest |
| E2E seed endpoints | Real Express app + MySQL test container | Vitest + testcontainers (future) |

Key test scenarios:
- `LoginUseCase.test.ts`: valid credentials → tokens, wrong password → 401, inactive user → 401
- `RefreshTokenUseCase.test.ts`: rotation, reuse detection → revocation
- `CreateSalonUseCase.test.ts`: superadmin creates salon, non-superadmin throws ForbiddenError
- `authGuard.test.ts`: missing token → 401, expired token → 401, valid → next()
- `errorHandler.test.ts`: AppError → structured JSON, unknown Error → 500 generic

## Migration / Rollout

No migration required — greenfield scaffolding on an empty repo. Delete directories + `docker compose down -v` to roll back.

## Open Questions

None. All decisions resolved: Turborepo + pnpm, TypeORM migrations, JWT auth, hexagonal per-module, Pino, Vitest.
