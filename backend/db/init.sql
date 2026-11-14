-- Inicialización de las bases de datos de desarrollo y test.
-- Ejecutar UNA vez como root (MySQL Workbench o consola):
--   "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysql.exe" -u root -p < backend\db\init.sql
-- Es idempotente: se puede volver a ejecutar sin romper nada.
-- La contraseña es solo para desarrollo local; en producción se usa otra (fase 16).

CREATE DATABASE IF NOT EXISTS tienda_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE DATABASE IF NOT EXISTS tienda_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'tienda'@'localhost' IDENTIFIED BY 'tienda_dev_pass';

GRANT ALL PRIVILEGES ON tienda_dev.* TO 'tienda'@'localhost';
GRANT ALL PRIVILEGES ON tienda_test.* TO 'tienda'@'localhost';

FLUSH PRIVILEGES;
