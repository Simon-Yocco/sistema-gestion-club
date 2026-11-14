# CLAUDE.md

Sistema de ventas de la tienda de ropa del club. Secretaría vende (con fiado, pago mixto, cambios, devoluciones y anulaciones) y registra egresos, préstamos de la comisión directiva y depósitos/extracciones bancarias. El administrador carga mercadería, gestiona productos y precios y ve reportes. El sistema lleva un **saldo virtual** por medio de pago (efectivo / transferencia).

## Documentos

- **`docs/reglas-negocio-tienda-club.md` es la fuente de verdad.** Si el plan o el código la contradicen, mandan las reglas.
- `docs/der.md`: modelo de datos (tablas, CHECKs, tipos de movimiento de fondos). Actualizarlo si cambia una migración.
- `docs/plan-desarrollo-tienda-club.md`: plan por fases y tareas (ej.: "tarea 6.3"). Cada tarea tiene criterio de aceptación; no avanzar hasta cumplirlo con tests pasando.

## Stack y decisiones técnicas

- JavaScript con **ES modules** en todo el proyecto. Monorepo: `backend/` y `frontend/`.
- Backend: Node.js + Express, **Sequelize** (modelos + migraciones), validación con **Zod**.
- Base: **MySQL 8+** (local: MySQL 9.7 instalado nativo, sin Docker). Bases `tienda_dev` y `tienda_test`, creadas con `backend/db/init.sql`.
- Auth: usuario y contraseña, bcrypt, JWT en cookie httpOnly. Roles: `secretaria`, `admin` (admin puede todo).
- Frontend: React + Vite + React Router + TanStack Query. UI simple; en secretaría, botones grandes y pocos pasos.
- Tests: Vitest + Supertest (backend, contra `tienda_test`), Vitest + Testing Library (frontend).
- **Dinero:** `DECIMAL(12,2)` en MySQL; en JS siempre en **centavos enteros** (`utils/money.js`).
- **Fechas:** se guardan en UTC, se muestran en hora de Argentina (`America/Argentina/Buenos_Aires`).

## Principios (valen para todo el sistema)

1. **Nada se borra.** Ventas, pagos, movimientos y egresos no tienen DELETE. Las correcciones se hacen con anulaciones o movimientos inversos.
2. **Auditoría.** Toda tabla operativa tiene `usuario_id` y `created_at`.
3. **Transacciones.** Toda operación que toque stock y dinero a la vez (venta, cambio, devolución, anulación) va en **una sola transacción**. Si algo falla, no se guarda nada.
4. **Stock nunca negativo.** Descontar con `UPDATE variante SET stock = stock - ? WHERE id = ? AND stock >= ?` y verificar que afectó 1 fila; si no, abortar la transacción.
5. **El saldo no se guarda.** Saldo por medio = `SUM(monto)` de `movimiento_fondos`.
6. **La deuda de una venta no se guarda.** Deuda = total vigente − pagos netos. El estado de pago (pagada / parcial / pendiente) se calcula.
7. **Precio y costo congelados.** Cada `venta_item` guarda precio y costo unitario del momento de la venta.
8. **Permisos en el backend.** El frontend oculta lo que el rol no puede hacer, pero la validación real está en la API.

## Arquitectura del backend

```
backend/src/
  config/  models/  migrations/  seeders/  middlewares/  utils/
  modules/<modulo>/<modulo>.{routes,controller,service,schemas}.js
backend/tests/
```

- **La lógica de negocio va en los services**; los controllers solo traducen HTTP.
- **Todo endpoint de negocio** usa `requireAuth, requirePermiso('<accion>')` (`src/middlewares/auth.js`), con acciones de la matriz `src/config/permisos.js`. Si hace falta una acción nueva, se agrega ahí, según la sección 2 de las reglas. `req.user` tiene `{ id, nombre, username, rol, activo }`, leído de la base en cada request.
- Valores de ENUM en `src/config/constantes.js`; modelos en `src/models/index.js`.
- Tests con sesión: `loginComoAdmin()` / `loginComoSecretaria()` de `tests/helpers/auth.js` devuelven un `agent` con la cookie. Fábricas en `tests/helpers/factories.js`.
- Errores con `AppError` (código HTTP + código de negocio, ej. `STOCK_INSUFICIENTE`); la API responde siempre `{ error: { code, message, details } }`.

## Comandos

Desde `backend/` o `frontend/`:

| Comando | Disponible desde |
|---|---|
| `npm run lint` / `npm run format` | Fase 0 |
| `npm run dev` / `npm start` (backend) | Fase 1 |
| `npm test` | Fase 1 (backend) / Fase 12 (frontend) |
| `npm run migrate` / `migrate:down` / `migrate:status` / `seed` (backend) | Fase 1 (migraciones y seeders desde la Fase 2) |
| `npm run dev` / `npm run build` (frontend) | Fase 12 |

Tests del backend: corren contra `tienda_test`, que se migra sola antes de la suite (`tests/setup/globalSetup.js`) y se vacía antes de cada test (`truncateAll()`). Los archivos de test corren de a uno (base compartida).

Migraciones con Umzug (`src/config/umzug.js`), en ESM: ver `src/migrations/README.md`.

MySQL no está en el PATH: el cliente está en `C:\Program Files\MySQL\MySQL Server 9.7\bin\mysql.exe`.

## Convención de commits

Un commit por tarea del plan, con el ID al principio del mensaje:
`6.3: registrar venta con descuento de stock`.
