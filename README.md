# Tienda club

Sistema de ventas de la tienda de ropa del club: ventas desde secretaría (con fiado, pago mixto, cambios, devoluciones y anulaciones), ingreso de mercadería, egresos, préstamos de la comisión directiva, saldos virtuales por medio de pago y reportes.

- Reglas de negocio (fuente de verdad): [docs/reglas-negocio-tienda-club.md](docs/reglas-negocio-tienda-club.md)
- Plan de desarrollo: [docs/plan-desarrollo-tienda-club.md](docs/plan-desarrollo-tienda-club.md)

## Stack

| Parte | Tecnología |
|---|---|
| Backend | Node.js + Express, Sequelize, Zod |
| Base de datos | MySQL 8+ (probado con 9.7) |
| Frontend | React + Vite + React Router + TanStack Query |
| Tests | Vitest + Supertest / Testing Library |

## Estructura

```
backend/    API Node.js
frontend/   App React
docs/       Reglas de negocio, plan y documentación
```

## Puesta en marcha (desarrollo)

Requisitos: Node.js 20+ y MySQL 8+ instalado y corriendo.

1. **Crear las bases de datos** (una sola vez). Ejecutar `backend/db/init.sql` como `root`:
   - En MySQL Workbench: *File → Open SQL Script…* → elegir `backend/db/init.sql` → ejecutar (⚡).
   - O por consola:
     ```
     "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysql.exe" -u root -p < backend\db\init.sql
     ```
   Crea `tienda_dev`, `tienda_test` y el usuario `tienda` con acceso solo a esas dos bases.

2. **Variables de entorno**: copiar `backend/.env.example` a `backend/.env` y `frontend/.env.example` a `frontend/.env`, y completar los valores (contraseña de la base, secreto JWT).

3. **Dependencias**:
   ```
   cd backend && npm install
   cd ../frontend && npm install
   ```

4. **Base de datos** (en `backend/`):
   ```
   npm run migrate   # crea las tablas
   npm run seed      # datos de ejemplo (solo desarrollo)
   ```
   Usuarios de ejemplo (solo desarrollo): `admin` / `admin1234` y `secretaria` / `secretaria1234`.

5. **Backend**: `npm run dev` en `backend/` → `http://localhost:3000/api/health`.

6. **Frontend**: `npm run dev` en `frontend/` → `http://localhost:5173` (con el backend corriendo; Vite reenvía `/api` al puerto 3000).

7. **Tests y lint**: `npm test` y `npm run lint` dentro de `backend/` o `frontend/` (los del backend usan `tienda_test` y la vacían en cada test).
