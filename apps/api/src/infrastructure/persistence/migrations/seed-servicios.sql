SET NAMES utf8mb4;

INSERT INTO categorias_servicio (nombre, descripcion, emoji, orden, salonId) VALUES
('Cabello', 'Corte, color y tratamientos capilares', '✂️', 1, 1),
('Uñas', 'Manicure, pedicure y extensiones', '💅', 2, 1),
('Cejas y Pestañas', 'Diseño, lifting y extensiones', '👁️', 3, 1),
('Maquillaje', 'Maquillaje social y para eventos', '💄', 4, 1),
('Depilación', 'Depilación facial y corporal', '🧴', 5, 1);

INSERT INTO servicios (nombre, descripcion, precioBase, duracionMinutos, categoriaId) VALUES
('Corte de cabello', 'Corte y peinado incluyendo lavado', 35000, 45, 1),
('Tintura completa', 'Aplicación de color uniforme en todo el cabello', 120000, 120, 1),
('Mechas/Balayage', 'Técnica de decoloración en mechas para efecto degradé', 180000, 180, 1),
('Alisado con keratina', 'Tratamiento de alisado con queratina brasileña', 200000, 150, 1),
('Hidratación capilar', 'Tratamiento hidratante profundo con ampollas', 55000, 45, 1),
('Peinado social', 'Peinado para eventos y ocasiones especiales', 45000, 60, 1),
('Retoque de raíz', 'Aplicación de color solo en raíces', 80000, 90, 1),
('Manicure tradicional', 'Corte de cutícula, limado y esmaltado', 20000, 45, 2),
('Manicure semipermanente', 'Esmaltado en gel con duración de 15 días', 35000, 60, 2),
('Pedicure spa', 'Tratamiento completo de pies con esmaltado', 28000, 60, 2),
('Uñas acrílicas', 'Extensión de uñas en acrílico con diseño', 60000, 90, 2),
('Diseño de cejas', 'Diseño con pinza o cera + tinte opcional', 18000, 30, 3),
('Lifting de pestañas', 'Elevación y curvatura natural de pestañas', 45000, 60, 3),
('Extensión de pestañas', 'Pestañas pelo a pelo efecto natural o volumen', 85000, 90, 3),
('Maquillaje social', 'Maquillaje para fiestas y eventos sociales', 100000, 60, 4),
('Maquillaje de novia', 'Maquillaje profesional con prueba incluida', 180000, 90, 4),
('Depilación facial', 'Depilación de bozo, cejas y patillas con cera', 25000, 30, 5),
('Baño de color', 'Tinte temporal sin amoníaco para revitalizar', 45000, 60, 1);
