# Plan de desarrollo – Sistema de ventas de la tienda de ropa del club

Plan paso a paso para implementar el sistema con Claude Code.
Las reglas de negocio están en `reglas-negocio-tienda-club.md` y **son la fuente de verdad**: si este plan y las reglas se contradicen, mandan las reglas.

---

## Cómo usar este plan

- Ejecutar las tareas **en orden**. Cada tarea depende de las anteriores salvo que se indique lo contrario.
- Pedirle a Claude Code **una tarea (o un grupo chico) por vez**, por ejemplo: *"Hacé la tarea 6.3 del plan"*.
- Cada tarea tiene un **criterio de aceptación**. No pasar a la siguiente hasta que se cumpla y los tests pasen.
- Hacer un **commit por tarea** con el ID en el mensaje (ej.: `6.3: registrar venta con descuento de stock`).
- Al terminar cada fase, revisar manualmente lo hecho antes de seguir.

---

## Decisiones técnicas

| Tema | Decisión |
|---|---|
| Lenguaje | JavaScript (ES modules) en frontend y backend |
| Estructura | Monorepo con carpetas `backend/` y `frontend/` |
| Backend | Node.js + Express |
| Base de datos | MySQL 8 |
| Acceso a datos | Sequelize (modelos + migraciones) |
| Validación | Zod (en backend; esquemas reutilizables) |
| Autenticación | Usuario y contraseña, hash con bcrypt, sesión con JWT en cookie httpOnly |
| Frontend | React + Vite + React Router |
| Pedidos HTTP / estado servidor | TanStack Query |
| UI | Componentes propios con CSS simple (o una librería liviana); prioridad: botones grandes y pocos pasos en secretaría |
| Tests backend | Vitest + Supertest, contra una base MySQL de test |
| Tests frontend | Vitest + Testing Library (componentes críticos) |
| Dinero | `DECIMAL(12,2)` en MySQL; en JS se trabaja en **centavos (enteros)** para evitar errores de redondeo |
| Fechas | Se guardan en UTC; se muestran en hora de Argentina |

### Principios que valen para todo el sistema

1. **Nada se borra.** Ventas, pagos, movimientos y egresos no tienen DELETE. Las correcciones se hacen con anulaciones o movimientos inversos.
2. **Auditoría.** Toda tabla operativa tiene `usuario_id` y `created_at`.
3. **Transacciones.** Toda operación que toque stock y dinero a la vez (venta, cambio, devolución, anulación) se hace dentro de **una sola transacción**. Si algo falla, no se guarda nada.
4. **Stock nunca negativo.** El descuento se hace con un `UPDATE variante SET stock = stock - ? WHERE id = ? AND stock >= ?` y se verifica que haya afectado 1 fila; si no, se aborta la transacción.
5. **El saldo no se guarda.** Saldo efectivo / transferencia = `SUM(monto)` de `movimiento_fondos` por medio.
6. **La deuda de una venta no se guarda.** Deuda = total vigente de la venta − pagos netos. El estado de pago (pagada / parcial / pendiente) se calcula.
7. **Precio y costo congelados.** Cada `venta_item` guarda el precio y el costo unitario del momento.
8. **Permisos en el backend.** El frontend oculta lo que el rol no puede hacer, pero la validación real está en la API.

---

## Fase 0 – Preparación del proyecto

**0.1 Crear el repositorio y la estructura de carpetas**
- Crear `backend/`, `frontend/`, `docs/` y un `README.md` raíz.
- Copiar `reglas-negocio-tienda-club.md` y este plan a `docs/`.
- Criterio: estructura creada y primer commit hecho.

**0.2 Crear `CLAUDE.md` en la raíz**
- Contenido mínimo: descripción del proyecto, referencia a `docs/reglas-negocio-tienda-club.md`, stack, los 8 principios de arriba, comandos para correr tests y levantar el proyecto, convención de commits.
- Criterio: Claude Code puede leer el archivo y entender el contexto sin explicaciones extra.

**0.3 Configurar `.gitignore` y `.editorconfig`**
- Ignorar `node_modules`, `.env`, builds.
- Criterio: `git status` limpio después de instalar dependencias.

**0.4 Configurar ESLint y Prettier** en ambos proyectos con la misma configuración.
- Criterio: `npm run lint` corre sin errores en ambos.

**0.5 Levantar MySQL con Docker Compose**
- `docker-compose.yml` con dos bases: `tienda_dev` y `tienda_test`.
- Criterio: `docker compose up -d` deja ambas bases accesibles.

**0.6 Crear `.env.example`** para backend (puerto, credenciales de DB, secreto JWT) y frontend (URL de la API).
- Criterio: copiando a `.env` el proyecto arranca.

---

## Fase 1 – Base del backend

**1.1 Inicializar el proyecto Node** (`backend/package.json`, ES modules, scripts `dev`, `start`, `test`, `lint`, `migrate`, `seed`).

**1.2 Servidor Express mínimo** con endpoint `GET /api/health` que responde `{ ok: true }`.
- Criterio: test con Supertest que verifica el health.

**1.3 Estructura de carpetas del backend**
```
src/
  config/        (env, db)
  models/        (Sequelize)
  migrations/
  seeders/
  modules/       (un módulo por dominio: productos, ventas, etc.)
    <modulo>/
      <modulo>.routes.js
      <modulo>.controller.js
      <modulo>.service.js    (lógica de negocio y transacciones)
      <modulo>.schemas.js    (Zod)
  middlewares/
  utils/
tests/
```
- Regla: **la lógica de negocio va en los services**, los controllers solo traducen HTTP.

**1.4 Conexión a MySQL con Sequelize** leyendo de `.env`, con base distinta para tests.
- Criterio: al arrancar, el servidor loguea conexión exitosa; falla con mensaje claro si no hay base.

**1.5 Manejo centralizado de errores**
- Clase `AppError` con código HTTP y código de negocio (ej.: `STOCK_INSUFICIENTE`).
- Middleware que devuelve siempre `{ error: { code, message, details } }`.
- Criterio: test que verifica formato de error para 400, 404 y 500.

**1.6 Middleware de validación con Zod** (`validate(schema)` para body, params y query).
- Criterio: un body inválido devuelve 400 con detalle de campos.

**1.7 Utilidades de dinero** (`utils/money.js`): convertir entre DECIMAL y centavos, sumar, restar, formatear.
- Criterio: tests unitarios con casos de redondeo.

**1.8 Configurar el entorno de tests**
- Antes de la suite: correr migraciones en `tienda_test`. Entre tests: limpiar tablas.
- Helpers para crear datos de prueba (usuario, producto con variantes, comprador).
- Criterio: `npm test` corre y deja la base limpia.

---

## Fase 2 – Base de datos

Cada tabla es una migración separada. Todas con `id` autoincremental, `created_at` y, si son operativas, `usuario_id`.

**2.1 Migración `usuario`**: nombre, username (único), password_hash, rol (`ENUM('secretaria','admin')`), activo.

**2.2 Migración `producto`**: nombre (único), descripción, precio_venta `DECIMAL(12,2)`, costo `DECIMAL(12,2)`, activo, updated_at.

**2.3 Migración `variante`**: producto_id (FK), talle, color, stock `INT UNSIGNED` default 0, activo. Índice **único** (producto_id, talle, color).

**2.4 Migración `comprador`**: nombre, numero_socio (único, nullable), telefono (nullable).

**2.5 Migración `ingreso_mercaderia`**: fecha, proveedor (nullable), observaciones, usuario_id.

**2.6 Migración `ingreso_item`**: ingreso_id, variante_id, cantidad, costo_unitario.

**2.7 Migración `venta`**: fecha, comprador_id (nullable), usuario_id, estado (`ENUM('activa','anulada')`), motivo_anulacion, anulada_por, anulada_at.

**2.8 Migración `venta_item`**: venta_id, variante_id, cantidad, precio_unitario, costo_unitario, cantidad_devuelta (default 0), origen (`ENUM('venta','cambio')`).
- `origen = 'cambio'` marca ítems agregados a una venta por un cambio.

**2.9 Migración `pago`**: venta_id, medio (`ENUM('efectivo','transferencia')`), monto (positivo = cobro, negativo = devolución de dinero), tipo (`ENUM('cobro','devolucion')`), usuario_id.

**2.10 Migración `devolucion`**: venta_id, motivo (obligatorio), usuario_id, fecha. Y `devolucion_item`: devolucion_id, venta_item_id, cantidad.

**2.11 Migración `cambio`**: venta_id (nullable, para cambios sin venta registrada), venta_item_devuelto_id (nullable), variante_devuelta_id, valor_devuelto, venta_item_nuevo_id, valor_nuevo, diferencia, resolucion (`ENUM('sin_diferencia','cobro','devolucion','ajuste_deuda')`), motivo, usuario_id.

**2.12 Migración `egreso`**: fecha, monto, medio, concepto (`ENUM('mercaderia','otro')`), descripcion, comprobante (nullable), ingreso_mercaderia_id (nullable), usuario_id.

**2.13 Migración `transferencia_medios`**: fecha, tipo (`ENUM('deposito','extraccion')`), monto (positivo), descripcion, comprobante (nullable), usuario_id.

**2.13b Migración `movimiento_fondos`**: fecha, medio, monto (con signo), tipo (`ENUM('cobro_venta','cobro_fiado','cobro_diferencia_cambio','devolucion_diferencia_cambio','devolucion_anulacion','egreso','prestamo_recibido','devolucion_prestamo','deposito_bancario','extraccion_bancaria')`), referencia_tipo, referencia_id, descripcion, usuario_id.
- Índice por (medio) y por (fecha).

**2.14 Modelos Sequelize y asociaciones** para todas las tablas.
- Criterio: test que crea un producto con variantes y lo recupera con `include`.

**2.15 Seeder inicial**: un usuario admin y uno de secretaría con contraseñas de desarrollo, y 2 o 3 productos de ejemplo con variantes y stock.
- Criterio: `npm run seed` deja datos usables para probar.

**2.16 Documentar el DER** en `docs/der.md` (diagrama Mermaid generado a partir de las migraciones).

---

## Fase 3 – Autenticación y permisos

**3.1 Servicio de hash** de contraseñas con bcrypt.

**3.2 `POST /api/auth/login`**: valida credenciales, devuelve datos del usuario y setea cookie httpOnly con JWT.
- Usuario inactivo no puede entrar.
- Criterio: tests de login correcto, contraseña incorrecta y usuario inactivo.

**3.3 `POST /api/auth/logout`** y **`GET /api/auth/me`**.

**3.4 Middleware `requireAuth`**: lee la cookie, valida JWT, carga `req.user`.

**3.5 Middleware `requireRole(...roles)`**.
- Criterio: tests que verifican 401 sin sesión y 403 con rol incorrecto.

**3.6 Matriz de permisos** en `src/config/permisos.js`, siguiendo la sección 2 de las reglas. El admin puede todo.
- Criterio: cada endpoint creado de aquí en adelante usa esta matriz.

**3.7 ABM de usuarios (solo admin)**: listar, crear, editar, activar/desactivar, resetear contraseña. No se borran.

---

## Fase 4 – Productos, variantes y stock

**4.1 `GET /api/productos`**: lista con variantes y stock total. Filtros: activo, búsqueda por nombre.

**4.2 `GET /api/productos/:id`**: detalle con variantes agrupadas por color y talle.

**4.3 `POST /api/productos`** (admin): crea producto con precio, costo y una grilla de variantes (lista de colores × lista de talles) con stock inicial 0.
- Criterio: no se pueden crear variantes duplicadas (mismo talle y color).

**4.4 `PATCH /api/productos/:id`** (admin): editar nombre, descripción, precio, costo.
- El cambio de precio no afecta ventas ya hechas (se verifica en tests de la fase 6).

**4.5 Agregar variantes a un producto existente** (admin): nuevo color o nuevo talle.

**4.6 Activar/desactivar producto y variante** (admin). Los inactivos no aparecen para vender pero sí en reportes.

**4.7 `GET /api/stock`**: stock por producto/color/talle, con filtro "solo sin stock" y "solo con stock".

**4.8 Servicio interno `stockService`**: funciones `descontar(variante, cantidad, transaction)` y `reponer(variante, cantidad, transaction)`, aplicando el principio 4.
- Criterio: test de concurrencia — dos ventas simultáneas de la última unidad: solo una debe tener éxito.

---

## Fase 5 – Ingreso de mercadería

**5.1 `POST /api/ingresos`** (admin): fecha, proveedor, observaciones e ítems (variante + cantidad).
- El costo unitario se toma del producto y se guarda en cada ítem.
- Suma stock con `stockService.reponer` dentro de una transacción.
- No genera movimiento de fondos.
- Criterio: test que verifica stock sumado y costo guardado.

**5.2 `GET /api/ingresos`** con filtros por fecha y estado de pago (pagado / no pagado, según si tiene egresos asociados).

**5.3 `GET /api/ingresos/:id`** con ítems y egresos asociados.

---

## Fase 6 – Compradores y ventas

**6.1 ABM de compradores**: crear, editar, buscar por nombre, número de socio o teléfono.
- `numero_socio` único si se carga.

**6.2 Búsqueda rápida de compradores** (`GET /api/compradores?q=`) para autocompletar en la pantalla de venta.

**6.3 Servicio de cálculo de venta** (`ventaCalculos.js`), funciones puras y testeadas:
- `totalVigente(venta)` = Σ precio × (cantidad − cantidad_devuelta).
- `pagadoNeto(venta)` = Σ montos de pagos.
- `deuda(venta)` = totalVigente − pagadoNeto.
- `estadoPago(venta)` → pagada / parcial / pendiente.
- `ganancia(venta)` = Σ (precio − costo) × (cantidad − cantidad_devuelta).
- Criterio: tests unitarios con todos los casos (fiado total, parcial, mixto, con devoluciones).

**6.4 `POST /api/ventas`**: comprador (opcional), ítems (variante + cantidad) y pagos (0 o más, cada uno con medio y monto).
Dentro de una transacción:
1. Validar que haya al menos un ítem y que las variantes estén activas.
2. Congelar precio y costo actuales en cada `venta_item`.
3. Descontar stock (falla con `STOCK_INSUFICIENTE` indicando qué variante).
4. Validar que Σ pagos ≤ total (`PAGO_EXCEDE_TOTAL`).
5. Si Σ pagos < total, exigir comprador identificable (socio o teléfono) (`COMPRADOR_REQUERIDO_FIADO`).
6. Crear pagos y un `movimiento_fondos` `cobro_venta` por cada uno.
- Criterio: tests para venta pagada en efectivo, en transferencia, mixta, fiado total, fiado parcial, sin stock y pago excedido.

**6.5 `GET /api/ventas`**: listado con filtros (fecha, comprador, estado, estado de pago, usuario) y paginación. Incluye total, pagado, deuda y estado calculados.

**6.6 `GET /api/ventas/:id`**: detalle completo con ítems, pagos, devoluciones y cambios.

**6.7 Test de precio congelado**: vender, cambiar precio del producto, verificar que la venta mantiene el precio original.

---

## Fase 7 – Fiado y cobros

**7.1 `POST /api/ventas/:id/pagos`**: registrar uno o varios pagos sobre una venta con deuda.
- No puede superar la deuda.
- Genera `movimiento_fondos` tipo `cobro_fiado`.
- No se permite sobre ventas anuladas.
- Criterio: tests de pago parcial, pago total, pago excedido y venta anulada.

**7.2 `GET /api/deudores`**: compradores con deuda > 0, monto total adeudado, cantidad de ventas impagas y antigüedad (días desde la venta impaga más vieja). Orden por antigüedad o por monto.

**7.3 `GET /api/compradores/:id/cuenta`**: ventas del comprador con su deuda, para cobrar desde ahí.

---

## Fase 8 – Devoluciones y anulaciones

**8.1 Servicio de reintegro de dinero** (`reintegroService`): dado un monto a devolver y el medio elegido, crea el `pago` negativo y el `movimiento_fondos` negativo. Reutilizable por devoluciones, anulaciones y cambios.

**8.2 `POST /api/ventas/:id/devoluciones`**: ítems y cantidades a devolver, motivo obligatorio, medio de reintegro.
Dentro de una transacción:
1. Validar que no se devuelva más de lo vendido no devuelto.
2. Sumar `cantidad_devuelta` y reponer stock.
3. Recalcular deuda: si el nuevo total vigente queda por debajo de lo pagado, devolver la diferencia (regla 10: primero se reduce la deuda).
4. Registrar `devolucion` + `devolucion_item`.
- Criterio: tests con venta pagada (devuelve dinero), fiada (solo baja deuda) y parcialmente pagada (combinación).

**8.3 `POST /api/ventas/:id/anular`**: motivo obligatorio y medio de reintegro.
- Equivale a devolver todos los ítems pendientes + marcar `estado = anulada` con usuario y fecha.
- Una venta anulada no admite pagos, cambios ni devoluciones.
- Criterio: test que verifica stock repuesto, dinero devuelto y saldo correcto.

**8.4 Medio de reintegro con pago mixto**: permitir devolver repartido entre efectivo y transferencia (ej.: lo mismo que se cobró). Por defecto, proponer devolver en el medio en que se cobró.

---

## Fase 9 – Cambios

**9.1 `POST /api/ventas/:id/cambios`** (cambio con venta registrada): ítem devuelto + cantidad, variante nueva + cantidad, motivo opcional, y pago o medio de reintegro si corresponde.
Dentro de una transacción:
1. Marcar devolución del ítem original (`cantidad_devuelta`) y reponer stock.
2. Agregar un `venta_item` nuevo con `origen = 'cambio'`, precio y costo **actuales**, y descontar stock.
3. Calcular la diferencia = valor nuevo − valor devuelto (valor devuelto = precio original de la venta).
4. Resolver según las reglas de la sección 9:
   - Venta totalmente pagada:
     - diferencia > 0 → exigir cobro (puede ser mixto) → `cobro_diferencia_cambio`.
     - diferencia < 0 → reintegrar → `devolucion_diferencia_cambio`.
     - diferencia = 0 → nada.
   - Venta con deuda: la diferencia ajusta la deuda; si la deuda queda negativa, reintegrar el excedente.
5. Registrar el `cambio` con su resolución.
- Criterio: tests de los 5 escenarios (igual precio, más cara pagada, más barata pagada, más cara fiada, más barata fiada con deuda que queda negativa).

**9.2 `POST /api/cambios/sin-venta`** (cambio sin venta registrada): comprador, variante devuelta, variante nueva. *Eliminado en reglas v1.3: la situación no ocurre.*
- La prenda devuelta entra al stock valuada al **precio actual**.
- Se crea una venta nueva con la prenda nueva; el valor de la devuelta se aplica como crédito (no genera movimiento de fondos).
- La diferencia se cobra o se reintegra en el momento, igual que en 9.1.
- Criterio: tests con diferencia positiva, negativa y cero.

**9.3 Mostrar cambios** en el detalle de la venta (ítem que salió, ítem que entró, diferencia y cómo se resolvió).

---

## Fase 10 – Fondos: egresos, préstamos y saldos

**10.1 `POST /api/egresos`**: monto, medio, concepto, descripción, comprobante, ingreso de mercadería opcional.
- Genera `movimiento_fondos` tipo `egreso` (negativo).
- Si el saldo del medio queda negativo, **no bloquea**: la respuesta incluye `advertencia: SALDO_NEGATIVO`.
- Criterio: tests con y sin saldo suficiente.

**10.2 `GET /api/egresos`** con filtros por fecha, concepto y medio.

**10.3 `POST /api/prestamos`**: tipo (`recibido` / `devolucion`), monto, medio, descripción.
- Genera el movimiento correspondiente (+ / −).
- Criterio: test que verifica saldo y deuda con la comisión.

**10.3b `POST /api/transferencias-medios`**: tipo (`deposito` / `extraccion`), monto, descripción, comprobante.
Dentro de una transacción:
1. Crear el registro en `transferencia_medios`.
2. Depósito: movimiento `deposito_bancario` −monto en efectivo y +monto en transferencia. Extracción: `extraccion_bancaria` −monto en transferencia y +monto en efectivo.
3. Ambos movimientos referencian al mismo registro.
- Si el medio de origen queda negativo, no bloquea: devuelve `advertencia: SALDO_NEGATIVO`.
- Criterio: tests que verifican que el saldo total no cambia, que cada medio cambia en ±monto, y que un monto ≤ 0 se rechaza.

**10.3c `GET /api/transferencias-medios`** con filtros por fecha y tipo.

**10.4 `GET /api/saldos`**: saldo en efectivo, saldo en transferencia, total, y deuda con la comisión directiva (Σ préstamos recibidos − Σ devoluciones de préstamo).

**10.5 `GET /api/movimientos`**: libro de movimientos con filtros (fecha, medio, tipo), paginado, con saldo acumulado por fila.

**10.6 Test de consistencia global**: después de una serie de operaciones mezcladas (ventas, fiados, cobros, cambios, devoluciones, anulaciones, egresos, préstamos, depósitos y extracciones), verificar que:
- el saldo por medio coincide con la suma esperada,
- el stock de cada variante coincide con ingresos − vendidos + devueltos,
- la deuda de cada venta coincide con el cálculo manual.

---

## Fase 11 – Reportes (backend)

Todos los reportes solo para admin, con filtro de período (desde / hasta).

**11.1 Ventas por período**: cantidad de ventas, unidades, total vendido; detalle por producto, color y talle. Excluye unidades devueltas y ventas anuladas.

**11.2 Ventas por medio de pago**: total cobrado en efectivo y en transferencia en el período (según pagos, no según ventas).

**11.3 Ganancia**: por período, por producto y por variante. Ingresos, costo, ganancia y margen %.

**11.4 Stock valorizado**: unidades por variante, valor a costo y a precio de venta.

**11.5 Anulaciones y devoluciones**: listado con fecha, venta, monto, motivo y usuario.

**11.6 Egresos por período**, agrupados por concepto.

**11.7 Deuda con la comisión directiva**: historial de préstamos y devoluciones.

**11.7b Depósitos y extracciones bancarias** por período, con totales de cada tipo.

**11.8 Exportación a CSV** de cada reporte (`?formato=csv`).

---

## Fase 12 – Base del frontend

**12.1 Inicializar Vite + React** en `frontend/`, con scripts `dev`, `build`, `test`, `lint`.

**12.2 Estructura de carpetas**
```
src/
  api/          (cliente HTTP y funciones por módulo)
  components/   (UI reutilizable)
  features/     (una carpeta por dominio: ventas, productos, etc.)
  pages/
  hooks/
  utils/        (formato de moneda y fechas)
  routes/
```

**12.3 Cliente HTTP** con `fetch`, `credentials: 'include'`, manejo uniforme de errores (muestra el `message` del backend).

**12.4 Configurar TanStack Query** y React Router.

**12.5 Contexto de autenticación**: usuario actual, login, logout, recarga con `/auth/me`.

**12.6 Rutas protegidas por rol**: secretaría no puede entrar a pantallas de admin (redirige).

**12.7 Layout**: barra superior con usuario y logout, menú según rol. Para secretaría, el menú debe tener pocas opciones y bien visibles.

**12.8 Componentes base**: Botón, Input, Select, Modal, Tabla con paginación, Toast de éxito/error, Confirmación, Selector de medio de pago, Input de dinero (formato $ argentino).

**12.9 Utilidades de formato**: moneda (`$ 15.000,00`), fecha y hora en zona Argentina.

**12.10 Pantalla de login.**

---

## Fase 13 – Pantallas de secretaría

Prioridad: **rapidez y difícil de equivocarse**. Pocos clics, confirmaciones claras, totales siempre visibles.

**13.1 Pantalla "Nueva venta"**
- Buscador de producto (por nombre).
- Al elegir producto: grilla de color × talle mostrando stock; las variantes sin stock se ven deshabilitadas.
- Carrito con ítems, cantidades editables y total.
- Sección de pago: agregar uno o más pagos (medio + monto), botón "Pagar todo en efectivo" / "Pagar todo con transferencia".
- Muestra en vivo: total, pagado, saldo pendiente.
- Comprador: autocompletar o crear uno nuevo en el momento. Si queda saldo pendiente (fiado), el comprador con socio o teléfono es obligatorio y se avisa.
- Pantalla de confirmación con resumen antes de guardar.
- Criterio: se puede hacer una venta simple en efectivo en menos de 5 clics después de elegir la prenda.

**13.2 Pantalla "Ventas"**: listado del día por defecto, con filtros y estado de pago. Acceso al detalle.

**13.3 Detalle de venta** con acciones según estado: Cobrar, Cambiar prenda, Devolver, Anular.

**13.4 Modal "Cobrar"** (fiado): muestra la deuda, permite pago parcial o total y mixto.

**13.5 Flujo "Cambiar prenda"**
- Elegir ítem a devolver → elegir prenda nueva (misma grilla color × talle) → el sistema muestra la diferencia y qué hay que hacer (cobrar X / devolver X / ajusta deuda) → confirmar.

**13.6 Flujo "Cambio sin venta registrada"**: accesible desde el menú; elegir comprador, prenda devuelta y prenda nueva. *Eliminado en reglas v1.3.*

**13.7 Flujo "Devolver"**: elegir ítems y cantidades, motivo obligatorio, mostrar cuánto se devuelve y en qué medio.

**13.8 Flujo "Anular"**: confirmación fuerte (escribir el motivo), mostrar lo que se va a devolver.

**13.9 Pantalla "Deudores"**: lista con monto y antigüedad, acceso a la cuenta del comprador y cobro directo.

**13.10 Pantalla "Stock"** (consulta): buscador, grilla por producto con color × talle.

**13.11 Pantalla "Egresos"**: formulario para registrar un pago + listado. Si el saldo queda negativo, mostrar la advertencia antes de confirmar.

**13.12 Pantalla "Préstamos de la comisión"**: registrar préstamo recibido o devolución, ver deuda actual.

**13.12b Pantalla "Depósito / extracción bancaria"**: formulario simple (tipo, monto, comprobante), que muestra cómo quedan los saldos de efectivo y transferencia antes de confirmar, más listado de los últimos registrados.

**13.13 Indicador de saldos** visible (efectivo / transferencia) en la pantalla principal de secretaría.

---

## Fase 14 – Pantallas de administrador

**14.1 Productos**: listado, alta con grilla de variantes (cargar colores y talles), edición de precio y costo, activar/desactivar.

**14.2 Ingreso de mercadería**: elegir producto → grilla color × talle para cargar cantidades → confirmar. Listado de ingresos con estado pagado / no pagado.

**14.3 Usuarios**: ABM, reseteo de contraseña.

**14.4 Dashboard de inicio**: saldos, deuda con la comisión, ventas del día y del mes, total adeudado por fiado, productos con poco stock.

**14.5 Reportes**: una pantalla por reporte de la fase 11 con filtro de fechas, tabla, totales y botón de exportar CSV.

**14.6 Gráficos simples** en ventas y ganancia (por día y por producto).

**14.7 Libro de movimientos** con filtros y saldo acumulado.

---

## Fase 15 – Pruebas integrales y calidad

**15.1 Tests E2E** con Playwright de los flujos principales: login, venta simple, venta mixta, fiado + cobro, cambio, devolución, anulación, egreso con saldo negativo, depósito bancario.

**15.2 Revisión de permisos**: test automático que recorre todos los endpoints con rol secretaría y verifica 403 en los de admin.

**15.3 Revisión de validaciones**: montos negativos o cero, cantidades inválidas, textos vacíos, IDs inexistentes.

**15.4 Revisión de UX en secretaría** con alguien que no conozca el sistema (idealmente una de las chicas): anotar dudas y corregir.

**15.5 Prueba en celular/tablet** si secretaría lo va a usar en esos dispositivos (diseño responsive).

---

## Fase 16 – Puesta en producción

**16.1 Elegir hosting** (backend Node + MySQL; frontend estático). Opciones a evaluar por costo: un VPS chico, o servicios administrados con plan gratuito/económico.

**16.2 Build de producción** del frontend y servir los archivos estáticos (desde Express o desde el hosting).

**16.3 Variables de entorno de producción** y secreto JWT seguro. HTTPS obligatorio.

**16.4 Correr migraciones en producción** y crear el usuario admin inicial (sin seeds de ejemplo).

**16.5 Backups automáticos diarios** de la base MySQL, con prueba de restauración.

**16.6 Logs** de errores del servidor accesibles.

---

## Fase 17 – Arranque en el club

**17.1 Carga inicial**: productos actuales con sus variantes y un ingreso de mercadería con el stock real contado.

**17.2 Saldo inicial**: registrar el dinero con el que arranca la tienda como movimientos iniciales (efectivo y transferencia), y préstamos vigentes con la comisión si los hay.

**17.3 Fiados previos**: cargar como ventas fiadas las deudas que ya existen.

**17.4 Crear usuarios** de secretaría y capacitarlas con una guía corta (`docs/guia-secretaria.md`) con capturas de cada flujo.

**17.5 Período de prueba** de 1 o 2 semanas: revisar diariamente saldos y stock contra la realidad y corregir errores.

---

## Resumen de fases

| Fase | Contenido | Resultado |
|---|---|---|
| 0 | Preparación | Repo, Docker, CLAUDE.md |
| 1 | Base backend | Express, errores, validación, tests |
| 2 | Base de datos | Migraciones, modelos, seeds |
| 3 | Autenticación | Login, roles, usuarios |
| 4 | Productos y stock | ABM y control de stock |
| 5 | Ingreso de mercadería | Carga de stock con costo |
| 6 | Ventas | Venta con pagos y fiado |
| 7 | Fiado | Cobros y deudores |
| 8 | Devoluciones y anulaciones | Reintegros con stock |
| 9 | Cambios | Sobre venta registrada |
| 10 | Fondos | Egresos, préstamos, depósitos, saldos |
| 11 | Reportes backend | Ventas, ganancia, stock, etc. |
| 12 | Base frontend | Layout, auth, componentes |
| 13 | Pantallas secretaría | Operación diaria |
| 14 | Pantallas admin | Gestión y reportes |
| 15 | Calidad | E2E, permisos, UX |
| 16 | Producción | Deploy y backups |
| 17 | Arranque | Carga inicial y capacitación |

**Primera versión usable (MVP):** fases 0 a 8, 10 (sin préstamos), 12 y 13.1–13.4 + 14.1–14.2. Con eso secretaría ya puede vender, cobrar fiado y anular, y el admin cargar mercadería. El resto se suma después.
