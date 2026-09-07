import 'reflect-metadata';
import { DataSource } from 'typeorm';
import logger from './logger';

/**
 * TypeORM DataSource configured for MySQL 8.
 * synchronize: false — all schema changes go through migrations.
 * Uses Pino for structured logging instead of console.log.
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME ?? 'posfinal',
  password: process.env.DB_PASSWORD ?? 'posfinal',
  database: process.env.DB_DATABASE ?? 'salon_saas',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  // Migraciones SOLO si NO hay synchronize (correr ambas es contradictorio:
  // synchronize crea el schema desde entidades; las migraciones viejas como
  // CreatePrestamos tienen SQL inválido para MySQL 8 y chocan).
  migrationsRun: process.env.DB_SYNCHRONIZE !== 'true' && process.env.NODE_ENV === 'production',
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'schema'] : ['error'],
  entities: [__dirname + '/../infrastructure/persistence/entities/**/*.{ts,js}'],
  migrations: [__dirname + '/../infrastructure/persistence/migrations/**/*.{ts,js}'],
  charset: 'utf8mb4',
  timezone: 'Z',
  // Columnas DATE (solo fecha, sin hora) → devolver como string 'YYYY-MM-DD'
  // crudo. Sin esto mysql2 las convierte a Date en UTC y TypeORM las formatea
  // con la TZ local del proceso (America/Bogota) → se corren UN DÍA atrás al
  // serializar (bug: caja del 07/09 aparecía como 06/09). Las DATETIME quedan
  // como Date (no incluidas en el array).
  dateStrings: ['DATE'],
});

/**
 * Initialize the database connection with structured error handling.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    logger.info({ component: 'database' }, 'Connecting to MySQL...');
    await AppDataSource.initialize();
    logger.info({ component: 'database' }, 'Database connection established successfully');
  } catch (error) {
    logger.error({ component: 'database', err: error }, 'Failed to connect to MySQL');
    process.exit(1);
  }
}
