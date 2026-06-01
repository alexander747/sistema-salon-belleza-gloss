/**
 * seed-citas.ts
 *
 * Standalone script that creates test citas for the salon by calling the running API.
 * Run AFTER the server is started and the main seed has been executed:
 *
 *   npx tsx apps/api/src/infrastructure/persistence/seed-citas.ts
 *
 * Prerequisites:
 * - API server running on http://localhost:3001
 * - Main seed run (employees, clients, services seeded)
 * - Dueña credentials: duena@test.com / duena123
 */

const API_BASE = 'http://localhost:3001/api';

interface TokenResponse {
  accessToken: string;
  user: { id: number; salonId: number };
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Empleada {
  id: number;
  nombre: string;
}

interface Servicio {
  id: number;
  nombre: string;
  duracionMinutos: number;
  categoriaId: number;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} on ${options.method ?? 'GET'} ${url}: ${body}`);
  }

  return res.json() as Promise<T>;
}

async function main() {
  console.log('🔐 Logging in as dueña...');
  const login = await request<TokenResponse>(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'duena@test.com', password: 'duena123' }),
  });

  const token = login.accessToken;
  const salonId = login.user.salonId;
  const authHeader = { Authorization: `Bearer ${token}` };
  console.log(`✅ Logged in (salonId: ${salonId})`);

  // ── 1. Configure business hours (Mon–Sat 9:00–18:00) ──────────
  console.log('🕐 Setting business hours...');
  const horarios = [
    { diaSemana: 0, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: false }, // Sunday closed
    { diaSemana: 1, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
    { diaSemana: 2, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
    { diaSemana: 3, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
    { diaSemana: 4, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
    { diaSemana: 5, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
    { diaSemana: 6, horaApertura: '09:00', horaCierre: '15:00', estaAbierto: true }, // Saturday until 3pm
  ];

  try {
    await request(`${API_BASE}/salones/${salonId}/agenda/horarios`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify(horarios),
    });
    console.log('✅ Business hours configured');
  } catch (e) {
    console.warn('⚠️ Could not set horarios (may already be set):', (e as Error).message);
  }

  // ── 2. Fetch existing data ────────────────────────────────────
  console.log('👤 Fetching clients...');
  const clientes = await request<Cliente[]>(`${API_BASE}/salones/${salonId}/clientes`, {
    headers: authHeader,
  });

  console.log('💁 Fetching employees...');
  const empleadas = await request<Empleada[]>(`${API_BASE}/salones/${salonId}/empleadas`, {
    headers: authHeader,
  });

  console.log('💇 Fetching services...');
  const servicios = await request<Servicio[]>(`${API_BASE}/salones/${salonId}/servicios`, {
    headers: authHeader,
  });

  if (clientes.length < 3) {
    throw new Error(`Only ${clientes.length} clients found — run seed.ts first`);
  }
  if (empleadas.length < 3) {
    throw new Error(`Only ${empleadas.length} employees found — run seed.ts first`);
  }
  if (servicios.length < 3) {
    throw new Error(`Only ${servicios.length} services found — run seed.ts first`);
  }

  console.log(`📊 Found ${clientes.length} clients, ${empleadas.length} employees, ${servicios.length} services`);

  // ── 3. Group services by category for meaningful combinations ─
  const svcsByCat = new Map<number, Servicio[]>();
  for (const s of servicios) {
    const cat = s.categoriaId;
    if (!svcsByCat.has(cat)) svcsByCat.set(cat, []);
    svcsByCat.get(cat)!.push(s);
  }

  // Helper: pick n random items from array
  function pick<T>(arr: T[], n: number = 1): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  function pickOne<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Helper: build ISO datetime from date string + HH:MM
  function buildDateTime(dateStr: string, timeStr: string): string {
    // "2026-06-15" + "09:00" → valid ISO (local time, the API creates a Date object)
    return new Date(`${dateStr}T${timeStr}:00`).toISOString();
  }

  // Days in June 2026 to spread citas across
  const juneWeekdays = [
    '2026-06-02', // Tue
    '2026-06-04', // Thu
    '2026-06-09', // Tue
    '2026-06-11', // Thu
    '2026-06-16', // Tue
    '2026-06-18', // Thu
    '2026-06-23', // Tue
    '2026-06-25', // Thu
  ];

  // Available time slots (within business hours)
  const timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

  // ── 4. Create citas ───────────────────────────────────────────
  const citasToCreate: Array<{
    clienteId: number;
    usuarioId: number;
    fechaHora: string;
    serviciosIds: number[];
    notas?: string;
  }> = [];

  // Keep track of used (employee, date, time) to avoid exact collisions
  const usedSlots = new Set<string>();

  function slotKey(empId: number, date: string, time: string): string {
    return `${empId}|${date}|${time}`;
  }

  // Ensure a unique employee-time slot
  function getUniqueEmployee(date: string, time: string): Empleada {
    for (const emp of [...empleadas].sort(() => Math.random() - 0.5)) {
      if (!usedSlots.has(slotKey(emp.id, date, time))) {
        usedSlots.add(slotKey(emp.id, date, time));
        return emp;
      }
    }
    // Fallback: reuse last employee (will try a different time)
    return pickOne(empleadas);
  }

  // --- Cita 1: Corte de cabello with Valentina (ADMINISTRADOR), client 1 ---
  const hairCat = [...svcsByCat.entries()].find(([_, svcs]) =>
    svcs.some((s) => s.nombre === 'Corte de cabello'),
  );
  const corteId = hairCat ? hairCat[1].find((s) => s.nombre === 'Corte de cabello')!.id : servicios[0].id;

  citasToCreate.push({
    clienteId: clientes[0].id,
    usuarioId: empleadas[0].id, // Valentina
    fechaHora: buildDateTime('2026-06-02', '09:00'),
    serviciosIds: [corteId],
    notas: 'Cliente nueva, recomendar productos',
  });

  // --- Cita 2: Manicura semipermanente with Camila, client 2 ---
  const nailCat = [...svcsByCat.entries()].find(([_, svcs]) =>
    svcs.some((s) => s.nombre === 'Manicura semipermanente'),
  );
  const manicureId = nailCat ? nailCat[1].find((s) => s.nombre === 'Manicura semipermanente')!.id : servicios[1].id;

  citasToCreate.push({
    clienteId: clientes[1].id,
    usuarioId: empleadas[1].id, // Camila
    fechaHora: buildDateTime('2026-06-02', '10:00'),
    serviciosIds: [manicureId],
  });

  // --- Cita 3: Extensiones de pestañas + Diseño de cejas (two services) with Carolina ---
  const lashCat = [...svcsByCat.entries()].find(([_, svcs]) =>
    svcs.some((s) => s.nombre === 'Extensiones de pestañas'),
  );
  const browCat = [...svcsByCat.entries()].find(([_, svcs]) =>
    svcs.some((s) => s.nombre === 'Diseño de cejas'),
  );
  const extensionesId = lashCat ? lashCat[1].find((s) => s.nombre === 'Extensiones de pestañas')!.id : servicios[0].id;
  const disenoCejasId = browCat ? browCat[1].find((s) => s.nombre === 'Diseño de cejas')!.id : servicios[0].id;

  citasToCreate.push({
    clienteId: clientes[2].id,
    usuarioId: empleadas[2].id, // María José
    fechaHora: buildDateTime('2026-06-04', '11:00'),
    serviciosIds: [extensionesId, disenoCejasId],
    notas: 'Primera vez con pestañas',
  });

  // --- Cita 4: Manicura básica at same time as Cita 3 but different employee (overlap test) ---
  citasToCreate.push({
    clienteId: clientes[3].id,
    usuarioId: empleadas[3].id, // Carolina
    fechaHora: buildDateTime('2026-06-04', '11:00'),
    serviciosIds: [manicureId],
  });

  // --- Cita 5: Alisado + Lavado + secado (two services) with Valentina ---
  const alisado = servicios.find((s) => s.nombre === 'Alisado');
  const lavado = servicios.find((s) => s.nombre === 'Lavado + secado');
  citasToCreate.push({
    clienteId: clientes[4].id,
    usuarioId: empleadas[0].id, // Valentina (manager does hair too)
    fechaHora: buildDateTime('2026-06-09', '09:00'),
    serviciosIds: [alisado!.id, lavado!.id],
    notas: 'Cita larga, 2h30m total',
  });

  // --- Cita 6: Pedicura básica with Camila ---
  const pedicura = servicios.find((s) => s.nombre === 'Pedicura básica');
  citasToCreate.push({
    clienteId: clientes[5].id,
    usuarioId: empleadas[1].id, // Camila
    fechaHora: buildDateTime('2026-06-11', '14:00'),
    serviciosIds: [pedicura!.id],
  });

  // --- Cita 7: Masaje relajante + Limpieza facial (different categories) with Paola ---
  const masaje = servicios.find((s) => s.nombre === 'Masaje relajante');
  const limpieza = servicios.find((s) => s.nombre === 'Limpieza facial');
  citasToCreate.push({
    clienteId: clientes[6].id,
    usuarioId: empleadas[5].id, // Paola
    fechaHora: buildDateTime('2026-06-16', '15:00'),
    serviciosIds: [masaje!.id, limpieza!.id],
    notas: 'Combo relax + skincare',
  });

  // --- Cita 8: Maquillaje social with Laura ---
  const maquillaje = servicios.find((s) => s.nombre === 'Maquillaje social');
  citasToCreate.push({
    clienteId: clientes[7].id,
    usuarioId: empleadas[6].id, // Laura
    fechaHora: buildDateTime('2026-06-18', '16:00'),
    serviciosIds: [maquillaje!.id],
    notas: 'Para evento de graduación',
  });

  // ── Create each cita via the API ──────────────────────────────
  console.log(`\n📋 Creating ${citasToCreate.length} citas...\n`);

  for (let i = 0; i < citasToCreate.length; i++) {
    const cita = citasToCreate[i];
    try {
      const result = await request<{ id: number }>(
        `${API_BASE}/salones/${salonId}/agenda/citas`,
        {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify(cita),
        },
      );
      console.log(`  ✅ Cita #${i + 1} created (ID: ${result.id}) — cliente ${cita.clienteId}, emp ${cita.usuarioId}, ${cita.fechaHora}`);
    } catch (err) {
      console.error(`  ❌ Cita #${i + 1} FAILED:`, (err as Error).message);
    }
  }

  console.log('\n🎉 seed-citas.ts completed');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
