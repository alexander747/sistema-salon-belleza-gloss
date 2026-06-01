CREATE DATABASE IF NOT EXISTS salon_saas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'posfinal'@'%' IDENTIFIED BY 'posfinal';
GRANT ALL PRIVILEGES ON salon_saas.* TO 'posfinal'@'%';
FLUSH PRIVILEGES;
