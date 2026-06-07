import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';

// Load .env BEFORE any module that reads process.env
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import bcrypt from 'bcrypt';
import { Rol } from '@pos-final/types';
import crypto from 'crypto';

async function seed(): Promise<void> {
  try {
    // Dynamic imports to ensure dotenv runs first (ESM hoists static imports)
    const [
      { AppDataSource },
      { SalonEntity },
      { UsuarioEntity },
      { CategoriaServicioEntity },
      { ServicioEntity },
      { ProductoEntity, TipoInventario },
      { ClienteEntity },
      { PlanEntity },
      { In },
    ] = await Promise.all([
      import('../../shared/database'),
      import('./entities/SalonEntity'),
      import('./entities/UsuarioEntity'),
      import('./entities/CategoriaServicioEntity'),
      import('./entities/ServicioEntity'),
      import('./entities/ProductoEntity'),
      import('./entities/ClienteEntity'),
      import('./entities/PlanEntity'),
      import('typeorm'),
    ]);

    await AppDataSource.initialize();
    console.log('📦 Database connected. Running seed...');

    const usuarioRepo = AppDataSource.getRepository(UsuarioEntity);

    // ---- SUPERADMIN user (cross-tenant, salonId=null) ----
    const existingSuperadmin = await usuarioRepo.findOneBy({ email: 'eder@gmail.com' });
    if (!existingSuperadmin) {
      const hash = await bcrypt.hash('Eder123', 12);
      await usuarioRepo.save({
        nombre: 'Superadmin',
        email: 'eder@gmail.com',
        passwordHash: hash,
        rol: Rol.SUPERADMIN,
        salonId: null,
        numeroWhatsApp: '0000000000',
        activo: true,
      });
      console.log('✅ Superadmin seeded: eder@gmail.com / Eder123');
    } else {
      console.log('⏩ Superadmin already exists, skipping');
    }

    // ---- Optional: test salon with dueña user ----
    const salonRepo = AppDataSource.getRepository(SalonEntity);
    const existingSalon = await salonRepo.findOneBy({ nombre: 'Salón de Prueba' });
    let salonId: number | null = null;

    if (!existingSalon) {
      const salonesCount = await salonRepo.count();
      // Only create test salon if no salons exist yet
      if (salonesCount === 0) {
        const salon = await salonRepo.save({
          nombre: 'Salón de Prueba',
          numeroWhatsApp: '573001234567',
          nombreBot: 'Asistente Virtual',
          tonoVoz: 'amigable',
          apiKeyN8n: crypto.randomBytes(32).toString('hex'),
          activo: true,
        });

        salonId = salon.id;

        const hash = await bcrypt.hash('duena123', 12);
        await usuarioRepo.save({
          nombre: 'Dueña de Prueba',
          email: 'duena@test.com',
          passwordHash: hash,
          rol: Rol.DUEÑA,
          salonId: salon.id,
          numeroWhatsApp: '573001234568',
          activo: true,
        });
        console.log(`✅ Test salon seeded: ${salon.nombre} (ID: ${salon.id})`);
        console.log('✅ Test dueña seeded: duena@test.com / duena123');
      } else {
        console.log('⏩ Other salons already exist — skipping salon/dueña creation');
      }
    } else {
      salonId = existingSalon.id;
      console.log(`⏩ Test salon already exists (ID: ${salonId}), skipping`);
    }

    // If no salon exists, we cannot proceed with the rest
    if (salonId === null) {
      console.log('⏩ No salon available — skipping employees, services, products, and clients');
      console.log('🎉 Seed completed (partial)');
      await AppDataSource.destroy();
      return;
    }

    // ========================================================================
    // 1. EMPLOYEES (MANICURISTA + ADMINISTRADOR)
    // ========================================================================
    const passwordHash = await bcrypt.hash('empleado123', 12);

    const employees = [
      // 1 ADMINISTRADOR (manager of the salon)
      { nombre: 'Valentina Restrepo', email: 'valentina@test.com', rol: Rol.ADMINISTRADOR, numeroWhatsApp: '573001234571', porcentajeComisionServicio: 10 },
      // 7 MANICURISTAS
      { nombre: 'Camila Fernández', email: 'camila@test.com', rol: Rol.MANICURISTA, numeroWhatsApp: '573001234572', porcentajeComisionServicio: 40 },
      { nombre: 'María José Gómez', email: 'mariaj@test.com', rol: Rol.MANICURISTA, numeroWhatsApp: '573001234573', porcentajeComisionServicio: 35 },
      { nombre: 'Carolina Medina', email: 'carolina@test.com', rol: Rol.MANICURISTA, numeroWhatsApp: '573001234574', porcentajeComisionServicio: 45 },
      { nombre: 'Daniela Rojas', email: 'daniela@test.com', rol: Rol.MANICURISTA, numeroWhatsApp: '573001234575', porcentajeComisionServicio: 30 },
      { nombre: 'Paola Sánchez', email: 'paola@test.com', rol: Rol.MANICURISTA, numeroWhatsApp: '573001234576', porcentajeComisionServicio: 50 },
      { nombre: 'Laura Jiménez', email: 'laura@test.com', rol: Rol.MANICURISTA, numeroWhatsApp: '573001234577', porcentajeComisionServicio: 35 },
      { nombre: 'Andrea Torres', email: 'andrea@test.com', rol: Rol.MANICURISTA, numeroWhatsApp: '573001234578', porcentajeComisionServicio: 40 },
    ];

    let empCreated = 0;
    for (const emp of employees) {
      const exists = await usuarioRepo.findOneBy({ email: emp.email });
      if (!exists) {
        await usuarioRepo.save({
          nombre: emp.nombre,
          email: emp.email,
          passwordHash,
          rol: emp.rol,
          salonId,
          numeroWhatsApp: emp.numeroWhatsApp,
          porcentajeComisionServicio: emp.porcentajeComisionServicio,
          activo: true,
        });
      empCreated++;
      }
    }
    console.log(`✅ ${empCreated} new employees seeded (password: empleado123)`);

    // ========================================================================
    // 2. SERVICE CATEGORIES
    // ========================================================================
    const catRepo = AppDataSource.getRepository(CategoriaServicioEntity);

    const categoryItems = [
      { nombre: 'Cabello', descripcion: 'Servicios de cabello', emoji: '💇‍♀️', orden: 1 },
      { nombre: 'Uñas', descripcion: 'Manicura y pedicura', emoji: '💅', orden: 2 },
      { nombre: 'Pestañas y Cejas', descripcion: 'Servicios de pestañas y cejas', emoji: '👁️', orden: 3 },
      { nombre: 'Depilación', descripcion: 'Depilación facial y corporal', emoji: '🪒', orden: 4 },
      { nombre: 'Maquillaje', descripcion: 'Maquillaje social y profesional', emoji: '💄', orden: 5 },
      { nombre: 'Skincare / Facial', descripcion: 'Cuidado de la piel y tratamientos faciales', emoji: '🧴', orden: 6 },
      { nombre: 'Masajes', descripcion: 'Masajes relajantes y descontracturantes', emoji: '💆‍♀️', orden: 7 },
    ];

    let catCreated = 0;
    for (const cat of categoryItems) {
      const exists = await catRepo.findOneBy({ nombre: cat.nombre, salonId });
      if (!exists) {
        await catRepo.save({ ...cat, salonId, activo: true });
        catCreated++;
      }
    }
    console.log(`✅ ${catCreated} new service categories created`);

    // ========================================================================
    // 3. SERVICES
    // ========================================================================
    const svcRepo = AppDataSource.getRepository(ServicioEntity);

    // Fetch categories by name to map categoryId
    const categories = await catRepo.find({ where: { salonId } });
    const catByName = Object.fromEntries(categories.map((c) => [c.nombre, c.id]));

    interface ServiceSeed {
      nombre: string;
      descripcion?: string;
      precioBase: number;
      duracionMinutos: number;
      categoriaId: number;
    }

    const services: ServiceSeed[] = [
      // ── Cabello ──
      { nombre: 'Corte de cabello', descripcion: 'Corte y peinado básico', precioBase: 25000, duracionMinutos: 30, categoriaId: catByName['Cabello'] },
      { nombre: 'Peinado', descripcion: 'Peinado con plancha o cepillo', precioBase: 35000, duracionMinutos: 30, categoriaId: catByName['Cabello'] },
      { nombre: 'Alisado', descripcion: 'Alisado permanente con keratina', precioBase: 120000, duracionMinutos: 120, categoriaId: catByName['Cabello'] },
      { nombre: 'Coloración', descripcion: 'Tinte completo con marcas profesionales', precioBase: 85000, duracionMinutos: 90, categoriaId: catByName['Cabello'] },
      { nombre: 'Keratina', descripcion: 'Tratamiento de keratina capilar', precioBase: 150000, duracionMinutos: 120, categoriaId: catByName['Cabello'] },
      { nombre: 'Balayage', descripcion: 'Técnica de mechas balayage', precioBase: 180000, duracionMinutos: 180, categoriaId: catByName['Cabello'] },
      { nombre: 'Lavado + secado', descripcion: 'Lavado con productos profesionales y secado', precioBase: 15000, duracionMinutos: 20, categoriaId: catByName['Cabello'] },
      { nombre: 'Tratamiento capilar', descripcion: 'Tratamiento reconstructor capilar', precioBase: 60000, duracionMinutos: 45, categoriaId: catByName['Cabello'] },

      // ── Uñas ──
      { nombre: 'Manicura básica', descripcion: 'Limpieza, limado y esmaltado', precioBase: 20000, duracionMinutos: 30, categoriaId: catByName['Uñas'] },
      { nombre: 'Manicura semipermanente', descripcion: 'Esmaltado semipermanente', precioBase: 35000, duracionMinutos: 45, categoriaId: catByName['Uñas'] },
      { nombre: 'Pedicura básica', descripcion: 'Pedicura completa con esmaltado', precioBase: 25000, duracionMinutos: 40, categoriaId: catByName['Uñas'] },
      { nombre: 'Uñas acrílicas', descripcion: 'Uñas esculpidas en acrílico', precioBase: 70000, duracionMinutos: 90, categoriaId: catByName['Uñas'] },
      { nombre: 'Uñas en gel', descripcion: 'Uñas esculpidas en gel', precioBase: 55000, duracionMinutos: 60, categoriaId: catByName['Uñas'] },
      { nombre: 'Nail art diseño', descripcion: 'Diseño decorativo adicional (extra)', precioBase: 0, duracionMinutos: 20, categoriaId: catByName['Uñas'] },

      // ── Pestañas y Cejas ──
      { nombre: 'Extensiones de pestañas', descripcion: 'Pestañas pelo a pelo', precioBase: 80000, duracionMinutos: 120, categoriaId: catByName['Pestañas y Cejas'] },
      { nombre: 'Lifting de pestañas', descripcion: 'Lifting con keratina', precioBase: 50000, duracionMinutos: 60, categoriaId: catByName['Pestañas y Cejas'] },
      { nombre: 'Diseño de cejas', descripcion: 'Diseño y perfilado de cejas', precioBase: 25000, duracionMinutos: 30, categoriaId: catByName['Pestañas y Cejas'] },
      { nombre: 'Henna de cejas', descripcion: 'Coloración temporal con henna', precioBase: 20000, duracionMinutos: 20, categoriaId: catByName['Pestañas y Cejas'] },

      // ── Depilación ──
      { nombre: 'Depilación facial completa', descripcion: 'Cera en todo el rostro', precioBase: 30000, duracionMinutos: 30, categoriaId: catByName['Depilación'] },
      { nombre: 'Cejas con hilo', descripcion: 'Técnica de hilo para cejas', precioBase: 15000, duracionMinutos: 15, categoriaId: catByName['Depilación'] },
      { nombre: 'Bozo', descripcion: 'Depilación de labio superior', precioBase: 10000, duracionMinutos: 10, categoriaId: catByName['Depilación'] },
      { nombre: 'Brazos', descripcion: 'Depilación completa de brazos', precioBase: 25000, duracionMinutos: 20, categoriaId: catByName['Depilación'] },

      // ── Maquillaje ──
      { nombre: 'Maquillaje social', descripcion: 'Maquillaje para día o eventos casuales', precioBase: 45000, duracionMinutos: 45, categoriaId: catByName['Maquillaje'] },
      { nombre: 'Maquillaje profesional', descripcion: 'Maquillaje con productos profesionales', precioBase: 65000, duracionMinutos: 60, categoriaId: catByName['Maquillaje'] },
      { nombre: 'Novias', descripcion: 'Maquillaje para novias (incluye prueba)', precioBase: 150000, duracionMinutos: 120, categoriaId: catByName['Maquillaje'] },

      // ── Skincare / Facial ──
      { nombre: 'Limpieza facial', descripcion: 'Limpieza facial profunda', precioBase: 55000, duracionMinutos: 45, categoriaId: catByName['Skincare / Facial'] },
      { nombre: 'Hidratación facial', descripcion: 'Hidratación intensiva con serum', precioBase: 45000, duracionMinutos: 30, categoriaId: catByName['Skincare / Facial'] },
      { nombre: 'Peeling químico', descripcion: 'Exfoliación química profesional', precioBase: 90000, duracionMinutos: 60, categoriaId: catByName['Skincare / Facial'] },

      // ── Masajes ──
      { nombre: 'Masaje relajante', descripcion: 'Masaje de relajación muscular', precioBase: 60000, duracionMinutos: 60, categoriaId: catByName['Masajes'] },
      { nombre: 'Masaje descontracturante', descripcion: 'Masaje para contracturas musculares', precioBase: 70000, duracionMinutos: 60, categoriaId: catByName['Masajes'] },
      { nombre: 'Masaje con piedras calientes', descripcion: 'Masaje terapéutico con piedras volcánicas', precioBase: 85000, duracionMinutos: 75, categoriaId: catByName['Masajes'] },
    ];

    let svcCreated = 0;
    for (const svc of services) {
      const exists = await svcRepo.findOneBy({ nombre: svc.nombre, categoriaId: svc.categoriaId });
      if (!exists) {
        await svcRepo.save({
          nombre: svc.nombre,
          descripcion: svc.descripcion ?? null,
          precioBase: svc.precioBase,
          duracionMinutos: svc.duracionMinutos,
          categoriaId: svc.categoriaId,
          activo: true,
        });
        svcCreated++;
      }
    }
    console.log(`✅ ${svcCreated} new services created`);

    // ========================================================================
    // 4. PRODUCTS
    // ========================================================================
    const prodRepo = AppDataSource.getRepository(ProductoEntity);

    const products = [
      // RETAIL (for sale to clients)
      { nombre: 'Shampoo profesional', descripcion: 'Shampoo para todo tipo de cabello', precioCompra: 15000, precioVenta: 35000, cantidadStock: 20, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Acondicionador profesional', descripcion: 'Acondicionador hidratante', precioCompra: 14000, precioVenta: 30000, cantidadStock: 20, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Aceite capilar', descripcion: 'Aceite de argán reparador', precioCompra: 12000, precioVenta: 25000, cantidadStock: 15, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Esmalte rojo', descripcion: 'Esmalte de uñas color rojo', precioCompra: 3000, precioVenta: 6500, cantidadStock: 25, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Esmalte nude', descripcion: 'Esmalte de uñas color nude', precioCompra: 3000, precioVenta: 6500, cantidadStock: 20, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Esmalte brillante', descripcion: 'Esmalte de uñas brillo transparente', precioCompra: 3500, precioVenta: 7500, cantidadStock: 20, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Base coat', descripcion: 'Base protectora para uñas', precioCompra: 3500, precioVenta: 8000, cantidadStock: 15, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Top coat', descripcion: 'Brillador sellador para uñas', precioCompra: 3500, precioVenta: 8000, cantidadStock: 15, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },
      { nombre: 'Kit de cuidado capilar', descripcion: 'Kit shampoo + acondicionador + mascarilla', precioCompra: 28000, precioVenta: 55000, cantidadStock: 10, stockMinimo: 5, tipoInventario: TipoInventario.RETAIL },

      // INTERNAL (for salon use, not for sale)
      { nombre: 'Algodón profesional', descripcion: 'Algodón desmaquillante profesional', precioCompra: 2000, precioVenta: 5000, cantidadStock: 50, stockMinimo: 5, tipoInventario: TipoInventario.INTERNAL },
      { nombre: 'Toallas desechables', descripcion: 'Toallas de papel facial', precioCompra: 1500, precioVenta: 3000, cantidadStock: 100, stockMinimo: 5, tipoInventario: TipoInventario.INTERNAL },
    ];

    let prodCreated = 0;
    for (const prod of products) {
      const exists = await prodRepo.findOneBy({ nombre: prod.nombre, salonId });
      if (!exists) {
        await prodRepo.save({
          nombre: prod.nombre,
          descripcion: prod.descripcion ?? null,
          precioCompra: prod.precioCompra,
          precioVenta: prod.precioVenta,
          cantidadStock: prod.cantidadStock,
          stockMinimo: prod.stockMinimo,
          tipoInventario: prod.tipoInventario,
          salonId,
          activo: true,
        });
        prodCreated++;
      }
    }
    console.log(`✅ ${prodCreated} new products created`);

    // ========================================================================
    // 5. CLIENTS (30 clientes de prueba con datos realistas)
    // ========================================================================
    const clientRepo = AppDataSource.getRepository(ClienteEntity);

    // Distribuir entre varios salones si existen
    const allSalones = await salonRepo.find();
    const salonIds = allSalones.map((s) => s.id);

    const clients = [
      // Salon 1 (o el único salón)
      { nombre: 'María Fernanda García',     telefono: '3001234567', cedula: '1012345678', email: 'maria.garcia@email.com' },
      { nombre: 'Ana Lucía Martínez',        telefono: '3002345678', cedula: '1023456789', email: 'ana.martinez@email.com' },
      { nombre: 'Sofía Patricia Rodríguez',  telefono: '3003456789', cedula: '1034567890', email: 'sofia.rodriguez@email.com' },
      { nombre: 'Carmen Elena López',        telefono: '3004567890', cedula: '1045678901' },
      { nombre: 'Diana Marcela Hernández',   telefono: '3005678901', cedula: '1056789012', email: 'diana.hernandez@email.com' },
      { nombre: 'Laura Cristina Sánchez',    telefono: '3006789012', cedula: '1067890123' },
      { nombre: 'Andrea del Pilar Ramírez',  telefono: '3007890123', cedula: '1078901234', email: 'andrea.ramirez@email.com' },
      { nombre: 'Natalia Jimena Torres',     telefono: '3008901234', cedula: '1089012345' },
      { nombre: 'Paola Andrea Morales',      telefono: '3009012345', cedula: '1090123456', email: 'paola.morales@email.com' },
      { nombre: 'Verónica del Carmen Castro', telefono: '3000123456', cedula: '1101234567' },
      // Más clientes
      { nombre: 'Gabriela Alexandra Ríos',   telefono: '3011234567', cedula: '1112345678', email: 'gabriela.rios@email.com' },
      { nombre: 'Luisa Fernanda Vargas',     telefono: '3012345678', cedula: '1123456789' },
      { nombre: 'Carolina de los Ángeles Peña', telefono: '3013456789', cedula: '1134567890', email: 'carolina.pena@email.com' },
      { nombre: 'Valentina María Castro',    telefono: '3014567890', cedula: '1145678901' },
      { nombre: 'Isabel Cristina Mejía',     telefono: '3015678901', cedula: '1156789012', email: 'isabel.mejia@email.com' },
      { nombre: 'Ximena Patricia Rojas',     telefono: '3016789012' },
      { nombre: 'Daniela Alejandra Silva',   telefono: '3017890123', cedula: '1167890123' },
      { nombre: 'Manuela José Herrera',      telefono: '3018901234', cedula: '1178901234', email: 'manuela.herrera@email.com' },
      { nombre: 'Fernanda Lucía Ortiz',      telefono: '3019012345' },
      { nombre: 'Catalina Andrea Pardo',     telefono: '3020123456', cedula: '1189012345', email: 'catalina.pardo@email.com' },
      // Clientes sin cédula (algunos)
      { nombre: 'Johanna Patricia Reyes',    telefono: '3021234567', email: 'johanna.reyes@email.com' },
      { nombre: 'Angela María Figueroa',     telefono: '3022345678' },
      { nombre: 'Rosa Elena Quintero',       telefono: '3023456789', cedula: '1190123456' },
      { nombre: 'Beatriz Adriana Mora',      telefono: '3024567890', email: 'beatriz.mora@email.com' },
      { nombre: 'Claudia Marcela Duarte',    telefono: '3025678901', cedula: '1201234567' },
      { nombre: 'Liliana del Socorro Vega',  telefono: '3026789012' },
      { nombre: 'Martha Cecilia Guzmán',     telefono: '3027890123', cedula: '1212345678', email: 'martha.guzman@email.com' },
      { nombre: 'Patricia Elena Navarro',    telefono: '3028901234' },
      { nombre: 'Adriana Milena Cortés',     telefono: '3029012345', cedula: '1223456789' },
      { nombre: 'Luz Marina Espinoza',       telefono: '3030123456', email: 'luz.espinoza@email.com' },
    ];

    let clientCreated = 0;
    for (let i = 0; i < clients.length; i++) {
      const cli = clients[i];
      // Distribute among existing salons
      const sId = salonIds[i % salonIds.length] ?? salonId;
      const exists = await clientRepo.findOneBy({ telefono: cli.telefono, salonId: sId });
      if (!exists) {
        await clientRepo.save({
          nombre: cli.nombre,
          telefono: cli.telefono,
          cedula: (cli as Record<string, string | undefined>).cedula ?? undefined,
          email: cli.email ?? undefined,
          salonId: sId,
          activo: true,
        });
        clientCreated++;
      }
    }
    console.log(`✅ ${clientCreated} new clients created`);

    // ---- DEFAULT PLANS ----
    const planRepo = AppDataSource.getRepository(PlanEntity);
    const existingPlans = await planRepo.count();
    if (existingPlans === 0) {
      await planRepo.save([
        {
          nombre: 'BASIC',
          precioMensual: 0,
          maxEmpleadas: 5,
          maxSucursales: 1,
          features: ['Agenda básica', 'Catálogo de servicios', 'Gestión de clientes', 'Dashboard financiero'],
          activo: true,
        },
        {
          nombre: 'PREMIUM',
          precioMensual: 29990,
          maxEmpleadas: 20,
          maxSucursales: 5,
          features: ['Todo lo de BASIC', 'Reportes avanzados', 'Nómina y comisiones', 'Ventas POS', 'Marketing WhatsApp', 'API para automatizaciones'],
          activo: true,
        },
      ]);
      console.log('✅ Default plans created');
    }

    console.log('🎉 Seed completed successfully');
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
