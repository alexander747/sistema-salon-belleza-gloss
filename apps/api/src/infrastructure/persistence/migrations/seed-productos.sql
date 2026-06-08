-- =============================================================
-- Seed: Productos de uso común en salones de belleza
-- Precios en COP (Colombia) con margen de ganancia del 30-40%
-- =============================================================
-- salonId = 1, tipoInventario = 'RETAIL' (para venta)
-- activo = 1, marca incluida donde aplica
-- =============================================================

-- ── Productos Capilares ──────────────────────────────────────

INSERT INTO productos (nombre, marca, precioCompra, precioVenta, margenGanancia, cantidadStock, stockMinimo, tipoInventario, activo, salonId)
VALUES
  ('Shampoo hidratante', 'L\'Oréal Professionnel', 30000, 45000, 33, 15, 5, 'RETAIL', 1, 1),
  ('Acondicionador reparador', 'L\'Oréal Professionnel', 28000, 42000, 33, 12, 5, 'RETAIL', 1, 1),
  ('Aceite de argán', 'Moroccanoil', 60000, 85000, 29, 8, 3, 'RETAIL', 1, 1),
  ('Mascarilla de keratina', 'Kérastase', 85000, 120000, 29, 6, 2, 'RETAIL', 1, 1),
  ('Serum antifrizz', 'Redken', 45000, 65000, 31, 10, 3, 'RETAIL', 1, 1),
  ('Espuma voluminizadora', 'Schwarzkopf', 27000, 38000, 29, 10, 3, 'RETAIL', 1, 1),
  ('Spray protector térmico', 'L\'Oréal Professionnel', 38000, 55000, 31, 10, 3, 'RETAIL', 1, 1),
  ('Tinte permanente rubio', 'Wella', 25000, 35000, 29, 20, 5, 'RETAIL', 1, 1),
  ('Tinte permanente castaño', 'Wella', 25000, 35000, 29, 20, 5, 'RETAIL', 1, 1),
  ('Oxidante 20 vol', 'Wella', 12000, 18000, 33, 25, 10, 'RETAIL', 1, 1),
  ('Decolorante en polvo', 'Schwarzkopf', 20000, 28000, 29, 15, 5, 'RETAIL', 1, 1);

-- ── Productos para Uñas ──────────────────────────────────────

INSERT INTO productos (nombre, marca, precioCompra, precioVenta, margenGanancia, cantidadStock, stockMinimo, tipoInventario, activo, salonId)
VALUES
  ('Esmalte semipermanente rojo', 'OPI', 32000, 45000, 29, 10, 3, 'RETAIL', 1, 1),
  ('Esmalte semipermanente nude', 'CND Shellac', 34000, 48000, 29, 10, 3, 'RETAIL', 1, 1),
  ('Esmalte semipermanente francesa', 'Gelish', 35000, 50000, 30, 8, 3, 'RETAIL', 1, 1),
  ('Removedor de esmalte acetona', NULL, 10000, 15000, 33, 20, 5, 'RETAIL', 1, 1),
  ('Base coat', 'OPI', 25000, 35000, 29, 10, 3, 'RETAIL', 1, 1),
  ('Top coat shine', 'CND', 27000, 38000, 29, 10, 3, 'RETAIL', 1, 1);

-- ── Productos de Depilación ──────────────────────────────────

INSERT INTO productos (nombre, marca, precioCompra, precioVenta, margenGanancia, cantidadStock, stockMinimo, tipoInventario, activo, salonId)
VALUES
  ('Cera depilatoria caliente', 'Mandy\'s', 17000, 25000, 32, 15, 5, 'RETAIL', 1, 1),
  ('Bandas depilatorias desechables', NULL, 8000, 12000, 33, 30, 10, 'RETAIL', 1, 1),
  ('Aceite post-depilación', NULL, 15000, 22000, 32, 12, 5, 'RETAIL', 1, 1);

-- ── Herramientas / Insumos ───────────────────────────────────

INSERT INTO productos (nombre, marca, precioCompra, precioVenta, margenGanancia, cantidadStock, stockMinimo, tipoInventario, activo, salonId)
VALUES
  ('Guantes desechables latex (caja 100)', NULL, 12000, 18000, 33, 10, 3, 'RETAIL', 1, 1),
  ('Capas desechables (paquete 50)', NULL, 10000, 15000, 33, 10, 3, 'RETAIL', 1, 1),
  ('Toallas faciales (paquete 10)', NULL, 17000, 25000, 32, 15, 5, 'RETAIL', 1, 1);
