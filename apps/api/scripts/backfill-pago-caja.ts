import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';

// Load .env BEFORE any module that reads process.env (mismo patrón que seed.ts)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Backfill OPCIONAL (una vez, idempotente): liga los pagos legacy
 * (pagos_transaccion.cajaId IS NULL) a la caja de su registro
 * (registros_servicio.cajaId). Después de correrlo, el arqueo cuenta esos
 * pagos por `pago.cajaId` directamente; los pagos sin registro con caja quedan
 * NULL y siguen resolviéndose por el fallback `registro.cajaId` (o no cuentan
 * si el registro tampoco tiene caja).
 *
 * Uso: cd apps/api && npx tsx scripts/backfill-pago-caja.ts
 */
async function backfillPagoCaja(): Promise<void> {
  // Dynamic import para que dotenv corra primero (ESM hoistea los imports estáticos)
  const [{ AppDataSource }] = await Promise.all([import('../src/shared/database')]);

  await AppDataSource.initialize();
  console.log('📦 Database connected. Running backfill pagos_transaccion.cajaId...');

  const result = await AppDataSource.query(
    `UPDATE pagos_transaccion p
     JOIN registros_servicio r ON r.id = p.registroServicioId
     SET p.cajaId = r.cajaId
     WHERE p.cajaId IS NULL AND r.cajaId IS NOT NULL`,
  );

  const affected = result?.affectedRows ?? 0;
  console.log(`✅ ${affected} pagos actualizados con la caja de su registro.`);
  await AppDataSource.destroy();
}

backfillPagoCaja().catch((err) => {
  console.error('❌ Backfill fallido:', err);
  process.exit(1);
});
