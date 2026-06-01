import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- salones ----
    await queryRunner.createTable(new Table({
      name: 'salones',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'nombre', type: 'varchar', length: '150' },
        { name: 'numeroWhatsApp', type: 'varchar', length: '20', isUnique: true },
        { name: 'nombreBot', type: 'varchar', length: '100', default: "'Asistente Virtual'" },
        { name: 'tonoVoz', type: 'varchar', length: '20', default: "'amigable'" },
        { name: 'plan', type: 'enum', enum: ['BASIC', 'PREMIUM'], default: "'BASIC'" },
        { name: 'estado', type: 'enum', enum: ['ACTIVO', 'SUSPENDIDO'], default: "'ACTIVO'" },
        { name: 'activo', type: 'tinyint', default: 1 },
        { name: 'apiKeyN8n', type: 'varchar', length: '64', isUnique: true },
        { name: 'logoUrl', type: 'varchar', length: '500', isNullable: true },
        { name: 'colorPrimario', type: 'varchar', length: '7', isNullable: true },
        { name: 'colorSecundario', type: 'varchar', length: '7', isNullable: true },
        { name: 'tema', type: 'varchar', length: '50', isNullable: true },
        { name: 'faqBase', type: 'json', isNullable: true },
        { name: 'redesSociales', type: 'json', isNullable: true },
        { name: 'horasCancelacion', type: 'int', default: 24 },
        { name: 'reglasTemporada', type: 'json', isNullable: true },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // ---- usuarios ----
    await queryRunner.createTable(new Table({
      name: 'usuarios',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'nombre', type: 'varchar', length: '100' },
        { name: 'numeroWhatsApp', type: 'varchar', length: '20' },
        { name: 'email', type: 'varchar', length: '200' },
        { name: 'passwordHash', type: 'varchar', length: '200', isNullable: true },
        { name: 'avatar', type: 'varchar', length: '255', isNullable: true },
        { name: 'fechaNacimiento', type: 'date', isNullable: true },
        { name: 'rol', type: 'int', default: 2 },
        { name: 'porcentajeComisionServicio', type: 'decimal', precision: 5, scale: 2, default: 0 },
        { name: 'sueldoFijo', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'bonoHorario', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'frecuenciaBono', type: 'varchar', length: '20', isNullable: true },
        { name: 'activo', type: 'tinyint', default: 1 },
        { name: 'refreshToken', type: 'text', isNullable: true },
        { name: 'refreshTokenFamily', type: 'varchar', length: '36', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('usuarios', new TableForeignKey({
      columnNames: ['salonId'],
      referencedTableName: 'salones',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));

    // ---- clientes ----
    await queryRunner.createTable(new Table({
      name: 'clientes',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'nombre', type: 'varchar', length: '100' },
        { name: 'telefono', type: 'varchar', length: '20' },
        { name: 'email', type: 'varchar', length: '200', isNullable: true },
        { name: 'puntajeConfianza', type: 'int', default: 100 },
        { name: 'cantidadNoShows', type: 'int', default: 0 },
        { name: 'puntosFidelidad', type: 'int', default: 0 },
        { name: 'totalServicios', type: 'int', default: 0 },
        { name: 'ultimaVisita', type: 'datetime', isNullable: true },
        { name: 'deudaTotal', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'servicioFrecuente', type: 'varchar', length: '100', isNullable: true },
        { name: 'activo', type: 'tinyint', default: 1 },
        { name: 'fechaNacimiento', type: 'date', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('clientes', new TableForeignKey({
      columnNames: ['salonId'],
      referencedTableName: 'salones',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));

    // ---- categorias_servicio ----
    await queryRunner.createTable(new Table({
      name: 'categorias_servicio',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'nombre', type: 'varchar', length: '100' },
        { name: 'descripcion', type: 'varchar', length: '300', isNullable: true },
        { name: 'emoji', type: 'varchar', length: '10', isNullable: true },
        { name: 'orden', type: 'int', default: 0 },
        { name: 'activo', type: 'tinyint', default: 1 },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('categorias_servicio', new TableForeignKey({
      columnNames: ['salonId'],
      referencedTableName: 'salones',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));

    // ---- servicios ----
    await queryRunner.createTable(new Table({
      name: 'servicios',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'nombre', type: 'varchar', length: '150' },
        { name: 'descripcion', type: 'varchar', length: '500', isNullable: true },
        { name: 'precioBase', type: 'decimal', precision: 12, scale: 2 },
        { name: 'duracionMinutos', type: 'int', default: 60 },
        { name: 'activo', type: 'tinyint', default: 1 },
        { name: 'categoriaId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('servicios', new TableForeignKey({
      columnNames: ['categoriaId'],
      referencedTableName: 'categorias_servicio',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));

    // ---- productos ----
    await queryRunner.createTable(new Table({
      name: 'productos',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'nombre', type: 'varchar', length: '150' },
        { name: 'marca', type: 'varchar', length: '100', isNullable: true },
        { name: 'color', type: 'varchar', length: '100', isNullable: true },
        { name: 'tamano', type: 'varchar', length: '50', isNullable: true },
        { name: 'descripcion', type: 'varchar', length: '500', isNullable: true },
        { name: 'urlFoto', type: 'varchar', length: '500', isNullable: true },
        { name: 'precioCompra', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'precioVenta', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'cantidadStock', type: 'decimal', precision: 10, scale: 2, default: 0 },
        { name: 'stockMinimo', type: 'decimal', precision: 10, scale: 2, default: 0 },
        { name: 'tipoInventario', type: 'enum', enum: ['RETAIL', 'INTERNAL'], default: "'RETAIL'" },
        { name: 'activo', type: 'tinyint', default: 1 },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('productos', new TableForeignKey({
      columnNames: ['salonId'],
      referencedTableName: 'salones',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));

    // ---- citas ----
    await queryRunner.createTable(new Table({
      name: 'citas',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'fechaHora', type: 'datetime' },
        { name: 'estado', type: 'enum', enum: ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA', 'NO_LLEGO'], default: "'PENDIENTE'" },
        { name: 'notas', type: 'varchar', length: '300', isNullable: true },
        { name: 'esWalkIn', type: 'tinyint', default: 0 },
        { name: 'notificadaCancelacion', type: 'tinyint', default: 0 },
        { name: 'motivoCancelacion', type: 'varchar', length: '300', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'usuarioId', type: 'int' },
        { name: 'clienteId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('citas', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('citas', new TableForeignKey({ columnNames: ['usuarioId'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('citas', new TableForeignKey({ columnNames: ['clienteId'], referencedTableName: 'clientes', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- citas_servicios (join table) ----
    await queryRunner.createTable(new Table({
      name: 'citas_servicios',
      columns: [
        { name: 'citaId', type: 'int' },
        { name: 'servicioId', type: 'int' },
      ],
    }), true);

    await queryRunner.createForeignKey('citas_servicios', new TableForeignKey({ columnNames: ['citaId'], referencedTableName: 'citas', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('citas_servicios', new TableForeignKey({ columnNames: ['servicioId'], referencedTableName: 'servicios', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createIndex('citas_servicios', new TableIndex({ columnNames: ['citaId', 'servicioId'], isUnique: true }));

    // ---- registros_servicio ----
    await queryRunner.createTable(new Table({
      name: 'registros_servicio',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'totalServicios', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'totalProductos', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'montoTotal', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'propina', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'comisionCalculada', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'esRetoque', type: 'tinyint', default: 0 },
        { name: 'descripcionServicio', type: 'varchar', length: '200', isNullable: true },
        { name: 'montoPendiente', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'estaPagadaEmpleada', type: 'tinyint', default: 0 },
        { name: 'notas', type: 'varchar', length: '500', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'usuarioId', type: 'int' },
        { name: 'clienteId', type: 'int' },
        { name: 'liquidacionId', type: 'int', isNullable: true },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('registros_servicio', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('registros_servicio', new TableForeignKey({ columnNames: ['usuarioId'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('registros_servicio', new TableForeignKey({ columnNames: ['clienteId'], referencedTableName: 'clientes', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- pagos_transaccion ----
    await queryRunner.createTable(new Table({
      name: 'pagos_transaccion',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'monto', type: 'decimal', precision: 12, scale: 2 },
        { name: 'metodoPago', type: 'enum', enum: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'], default: "'EFECTIVO'" },
        { name: 'referencia', type: 'varchar', length: '100', isNullable: true },
        { name: 'registroServicioId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('pagos_transaccion', new TableForeignKey({ columnNames: ['registroServicioId'], referencedTableName: 'registros_servicio', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- divisiones_registro ----
    await queryRunner.createTable(new Table({
      name: 'divisiones_registro',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'porcentajeParticipacion', type: 'decimal', precision: 5, scale: 2 },
        { name: 'comisionCorrespondiente', type: 'decimal', precision: 12, scale: 2 },
        { name: 'registroServicioId', type: 'int' },
        { name: 'usuarioId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('divisiones_registro', new TableForeignKey({ columnNames: ['registroServicioId'], referencedTableName: 'registros_servicio', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('divisiones_registro', new TableForeignKey({ columnNames: ['usuarioId'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- bloqueos_agenda ----
    await queryRunner.createTable(new Table({
      name: 'bloqueos_agenda',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'fechaInicio', type: 'datetime' },
        { name: 'fechaFin', type: 'datetime' },
        { name: 'tipo', type: 'enum', enum: ['PARCIAL', 'TOTAL'], default: "'PARCIAL'" },
        { name: 'motivo', type: 'varchar', length: '200', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'usuarioId', type: 'int', isNullable: true },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('bloqueos_agenda', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('bloqueos_agenda', new TableForeignKey({ columnNames: ['usuarioId'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));

    // ---- horarios_comerciales ----
    await queryRunner.createTable(new Table({
      name: 'horarios_comerciales',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'diaSemana', type: 'int' },
        { name: 'horaApertura', type: 'varchar', length: '5', isNullable: true },
        { name: 'horaCierre', type: 'varchar', length: '5', isNullable: true },
        { name: 'estaAbierto', type: 'tinyint', default: 1 },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('horarios_comerciales', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- fotos_portafolio ----
    await queryRunner.createTable(new Table({
      name: 'fotos_portafolio',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'urlFoto', type: 'varchar', length: '500' },
        { name: 'descripcion', type: 'varchar', length: '300', isNullable: true },
        { name: 'esFotoTrabajo', type: 'tinyint', default: 0 },
        { name: 'visible', type: 'tinyint', default: 1 },
        { name: 'servicioId', type: 'int' },
        { name: 'usuarioId', type: 'int', isNullable: true },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('fotos_portafolio', new TableForeignKey({ columnNames: ['servicioId'], referencedTableName: 'servicios', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('fotos_portafolio', new TableForeignKey({ columnNames: ['usuarioId'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));

    // ---- gastos ----
    await queryRunner.createTable(new Table({
      name: 'gastos',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'descripcion', type: 'varchar', length: '300' },
        { name: 'monto', type: 'decimal', precision: 12, scale: 2 },
        { name: 'metodoPago', type: 'enum', enum: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'], default: "'EFECTIVO'" },
        { name: 'esGastoFijo', type: 'tinyint', default: 0 },
        { name: 'categoria', type: 'varchar', length: '100', isNullable: true },
        { name: 'fecha', type: 'date' },
        { name: 'salonId', type: 'int' },
        { name: 'reportadoPorId', type: 'int', isNullable: true },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('gastos', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('gastos', new TableForeignKey({ columnNames: ['reportadoPorId'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));

    // ---- recompensas_fidelidad ----
    await queryRunner.createTable(new Table({
      name: 'recompensas_fidelidad',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'descripcion', type: 'varchar', length: '300' },
        { name: 'serviciosRequeridos', type: 'int' },
        { name: 'estado', type: 'enum', enum: ['PENDIENTE_APROBACION', 'APROBADA_Y_NOTIFICADA', 'CANJEADA'], default: "'PENDIENTE_APROBACION'" },
        { name: 'fechaAprobacion', type: 'datetime', isNullable: true },
        { name: 'fechaCanje', type: 'datetime', isNullable: true },
        { name: 'clienteId', type: 'int' },
        { name: 'servicioId', type: 'int', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('recompensas_fidelidad', new TableForeignKey({ columnNames: ['clienteId'], referencedTableName: 'clientes', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('recompensas_fidelidad', new TableForeignKey({ columnNames: ['servicioId'], referencedTableName: 'servicios', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));
    await queryRunner.createForeignKey('recompensas_fidelidad', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- devoluciones ----
    await queryRunner.createTable(new Table({
      name: 'devoluciones',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'motivo', type: 'varchar', length: '300' },
        { name: 'cantidad', type: 'decimal', precision: 10, scale: 2, default: 1 },
        { name: 'montoDevolucion', type: 'decimal', precision: 12, scale: 2 },
        { name: 'regresaAlStock', type: 'tinyint', default: 1 },
        { name: 'procesada', type: 'tinyint', default: 0 },
        { name: 'registroServicioId', type: 'int' },
        { name: 'productoId', type: 'int', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('devoluciones', new TableForeignKey({ columnNames: ['registroServicioId'], referencedTableName: 'registros_servicio', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('devoluciones', new TableForeignKey({ columnNames: ['productoId'], referencedTableName: 'productos', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));
    await queryRunner.createForeignKey('devoluciones', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- notificaciones ----
    await queryRunner.createTable(new Table({
      name: 'notificaciones',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'tipo', type: 'enum', enum: ['DISCREPANCIA_PRECIO', 'PRODUCTO_NO_REGISTRADO', 'RECOMPENSA_PENDIENTE', 'STOCK_BAJO', 'DEUDA_CLIENTE'] },
        { name: 'mensaje', type: 'varchar', length: '500' },
        { name: 'datos', type: 'json', isNullable: true },
        { name: 'leida', type: 'tinyint', default: 0 },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('notificaciones', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- campanas_marketing ----
    await queryRunner.createTable(new Table({
      name: 'campanas_marketing',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'titulo', type: 'varchar', length: '200' },
        { name: 'mensaje', type: 'text' },
        { name: 'urlImagen', type: 'varchar', length: '500', isNullable: true },
        { name: 'filtro', type: 'enum', enum: ['TODOS', 'VIP', 'INACTIVOS', 'POR_SERVICIO'], default: "'TODOS'" },
        { name: 'servicioFiltroId', type: 'int', isNullable: true },
        { name: 'topN', type: 'int', isNullable: true },
        { name: 'diasInactividad', type: 'int', isNullable: true },
        { name: 'totalEnviados', type: 'int', default: 0 },
        { name: 'estado', type: 'enum', enum: ['BORRADOR', 'ENVIADA'], default: "'BORRADOR'" },
        { name: 'fechaEnvio', type: 'datetime', isNullable: true },
        { name: 'salonId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('campanas_marketing', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // ---- liquidaciones ----
    await queryRunner.createTable(new Table({
      name: 'liquidaciones',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'fechaDesde', type: 'date' },
        { name: 'fechaHasta', type: 'date' },
        { name: 'totalServicios', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'totalComisiones', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'totalPropinas', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'sueldoFijo', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'bonoHorario', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'totalPagado', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'salonId', type: 'int' },
        { name: 'usuarioId', type: 'int' },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createForeignKey('liquidaciones', new TableForeignKey({ columnNames: ['salonId'], referencedTableName: 'salones', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));
    await queryRunner.createForeignKey('liquidaciones', new TableForeignKey({ columnNames: ['usuarioId'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'CASCADE' }));

    // FK de registros_servicio → liquidaciones (needs to come after liquidaciones table)
    await queryRunner.createForeignKey('registros_servicio', new TableForeignKey({ columnNames: ['liquidacionId'], referencedTableName: 'liquidaciones', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));

    // ---- bitacora ----
    await queryRunner.createTable(new Table({
      name: 'bitacora',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'nivel', type: 'enum', enum: ['INFO', 'WARN', 'ERROR'], default: "'INFO'" },
        { name: 'metodo', type: 'enum', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        { name: 'url', type: 'varchar', length: '500' },
        { name: 'accion', type: 'varchar', length: '200', isNullable: true },
        { name: 'mensaje', type: 'varchar', length: '500', isNullable: true },
        { name: 'requestData', type: 'json', isNullable: true },
        { name: 'responseData', type: 'json', isNullable: true },
        { name: 'statusCode', type: 'int', isNullable: true },
        { name: 'stackTrace', type: 'text', isNullable: true },
        { name: 'datosExtra', type: 'json', isNullable: true },
        { name: 'salonId', type: 'int', isNullable: true },
        { name: 'usuarioId', type: 'int', isNullable: true },
        { name: 'nombreSalon', type: 'varchar', length: '200', isNullable: true },
        { name: 'nombreUsuario', type: 'varchar', length: '200', isNullable: true },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // ---- membresias ----
    await queryRunner.createTable(new Table({
      name: 'membresias',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'salonId', type: 'int' },
        { name: 'plan', type: 'enum', enum: ['BASICO', 'PRO', 'ENTERPRISE'], default: "'BASICO'" },
        { name: 'estado', type: 'enum', enum: ['ACTIVA', 'SUSPENDIDA', 'CANCELADA'], default: "'ACTIVA'" },
        { name: 'fechaInicio', type: 'datetime' },
        { name: 'fechaFin', type: 'datetime', isNullable: true },
        { name: 'monto', type: 'decimal', precision: 12, scale: 2, default: 0 },
        { name: 'creadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'actualizadoEn', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order of creation (respect FK constraints)
    await queryRunner.dropTable('membresias');
    await queryRunner.dropTable('bitacora');
    await queryRunner.dropTable('campanas_marketing');
    await queryRunner.dropTable('notificaciones');
    await queryRunner.dropTable('devoluciones');
    await queryRunner.dropTable('recompensas_fidelidad');
    await queryRunner.dropTable('gastos');
    await queryRunner.dropTable('fotos_portafolio');
    await queryRunner.dropTable('horarios_comerciales');
    await queryRunner.dropTable('bloqueos_agenda');
    await queryRunner.dropTable('divisiones_registro');
    await queryRunner.dropTable('pagos_transaccion');
    await queryRunner.dropTable('liquidaciones');
    await queryRunner.dropTable('citas_servicios');
    await queryRunner.dropTable('citas');
    await queryRunner.dropTable('productos');
    await queryRunner.dropTable('servicios');
    await queryRunner.dropTable('categorias_servicio');
    await queryRunner.dropTable('clientes');
    await queryRunner.dropTable('usuarios');
    await queryRunner.dropTable('salones');
  }
}
