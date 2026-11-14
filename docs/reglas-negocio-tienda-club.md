# Sistema de ventas – Tienda de ropa del club

Documento de reglas de negocio. Versión 1.2 (sin puntos pendientes).

> 1.1 (14/11/2026): secretaría también puede consultar los saldos y la deuda con la comisión (2.1).
> 1.2 (14/11/2026): los compradores se identifican por nombre y apodo; para fiado hace falta el teléfono (5).

---

## 1. Descripción general

El club compra ropa y la vende desde secretaría. El sistema tiene que permitir:

- Cargar la mercadería que ingresa (prendas, talles, cantidades, precios).
- Que secretaría registre ventas de forma simple: seleccionar prenda, color, talle, medio de pago y comprador.
- Gestionar fiado, pagos mixtos, cambios, devoluciones y anulaciones.
- Registrar los pagos que la tienda hace desde secretaría (egresos).
- Saber en todo momento con cuánto dinero cuenta la tienda **en efectivo** y **en transferencias**.
- Obtener reportes de ventas, stock y deudores.

**Implementación elegida:** aplicación web propia.

**Stack:** JavaScript — React (frontend), Node.js (backend), MySQL (base de datos).

---

## 2. Roles y permisos

### 2.1 Secretaría

- Registrar ventas.
- Cobrar (ventas y cobros de fiado).
- Registrar cambios de prenda.
- Registrar devoluciones y anular ventas.
- Registrar egresos (pagos que hace la tienda).
- Registrar préstamos recibidos de la comisión directiva y sus devoluciones.
- Registrar depósitos de efectivo en el banco (y extracciones, si las hay).
- Consultar stock.
- Consultar deudores.
- Consultar los saldos (efectivo y transferencia) y la deuda con la comisión directiva.

### 2.2 Administrador

- Cargar ingresos de mercadería.
- Crear y editar productos y variantes.
- Cambiar precios.
- Ver reportes, saldos y el libro de movimientos de fondos.
- Puede realizar también todas las operaciones de secretaría.

### 2.3 Reglas generales

- Toda operación registra **qué usuario** la hizo y **cuándo**.
- Ninguna operación se borra: los errores se corrigen con anulaciones o movimientos inversos.

---

## 3. Productos y stock

- Un **producto** es la prenda (ej.: "Remera titular").
- Cada producto tiene **variantes**, definidas por la combinación de **talle y color**.
  - Ej.: "Remera titular" → M blanca, M azul, L blanca, L azul, etc.
  - No puede haber dos variantes del mismo producto con el mismo talle y color.
- El **stock vive en la variante**, no en el producto.

### 3.1 Precio

- El **precio de venta es único por producto**: no varía por talle ni por color.
  - Ej.: Remera titular $15.000, en cualquier talle y color.
- Un cambio de precio afecta a todas las variantes del producto a la vez.

### 3.2 Costo

- Una misma prenda **se compra siempre al mismo costo**, así que el costo se define a nivel **producto**.
- Si en algún momento el costo cambia (por ejemplo, por inflación), el administrador lo actualiza y rige para las compras siguientes.
- El stock **nunca puede quedar negativo**: si no hay stock de una variante, no se puede vender.
- Un producto puede desactivarse (deja de aparecer para la venta) sin borrarse, para conservar el historial.

---

## 4. Ingreso de mercadería

- Lo registra el **administrador**.
- Un ingreso tiene fecha, proveedor (opcional) y uno o más ítems.
- Cada ítem indica variante (producto + color + talle) y cantidad. El **costo unitario** se toma del producto y queda registrado en el ingreso.
- Al confirmar el ingreso, el stock de cada variante aumenta.
- El ingreso de mercadería **no mueve dinero**: el pago al proveedor se registra aparte como egreso (ver sección 12).

---

## 5. Compradores

- En el club los compradores se conocen por **nombre o apodo**, no por número de socio.
- Datos: nombre, apodo (opcional), teléfono y número de socio (opcional; hoy no se usa para identificar, queda por si se implementa en el futuro).
- Se busca por nombre, apodo o teléfono, y se muestra como `Juan Pérez ("el Turco")`. El apodo ayuda a distinguir a dos personas con el mismo nombre.
- Para ventas pagadas en el momento, alcanza con el nombre (o sin comprador).
- Para **fiado**, el comprador debe tener **nombre y teléfono**, para poder contactarlo y cobrarle después.

---

## 6. Ventas

- Una venta puede tener **varios ítems** (varias prendas, colores y/o talles).
- Cada ítem guarda el **precio unitario congelado** al momento de la venta. Un cambio de precio posterior no afecta ventas ya registradas.
- Al registrar la venta, el stock de cada variante se descuenta.
- Estado de pago de la venta, calculado a partir de sus pagos:
  - **Pagada:** pagos = total.
  - **Parcial:** 0 < pagos < total.
  - **Pendiente:** sin pagos (fiado total).
- Estado general: **activa** o **anulada**.

---

## 7. Pagos y pago mixto

- Medios de pago: **efectivo** y **transferencia**.
- Una venta puede tener **cero, uno o varios pagos**, cada uno con su medio y monto.
  - Ej.: $10.000 en efectivo + $5.000 por transferencia.
- La suma de los pagos **no puede superar** el total de la venta.
- Cada pago genera un **movimiento de fondos** positivo en el medio correspondiente.

---

## 8. Fiado

- Se admite vender sin cobrar total o parcialmente.
- El stock se descuenta **al vender**, aunque no se haya cobrado.
- El saldo de la tienda solo aumenta **cuando se cobra**.
- Se admiten **pagos parciales** posteriores, cada uno con su medio.
- Los cobros de fiado los registra secretaría.
- Debe existir un listado de **deudores** con monto adeudado y antigüedad de la deuda.

---

## 9. Cambios

- **No hay plazo máximo** para cambiar una prenda.
- **No se admite saldo a favor**: cualquier diferencia se resuelve en el momento.
- La prenda devuelta **vuelve al stock**; la prenda nueva **se descuenta** del stock.
- Precio de cada prenda:
  - Prenda devuelta: precio al que se vendió originalmente.
  - Prenda nueva: precio actual.
- **Cambio sin venta registrada** (prenda vendida antes de usar el sistema o venta no encontrada): la prenda devuelta ingresa con el **precio actual**. Es un caso poco frecuente.
- Resolución de la diferencia:
  - **Nueva más cara:** se cobra la diferencia como un pago normal (puede ser mixto).
  - **Nueva más barata:** se devuelve la diferencia en el momento y se registra como movimiento negativo en el medio con que se devuelve.
  - **Mismo precio:** no hay movimiento de dinero.
- **Cambio sobre una venta fiada (no pagada en su totalidad):**
  - La diferencia no mueve dinero: ajusta la deuda del comprador (sube o baja).
  - Si la deuda quedara negativa (ya había pagado más que el nuevo total), la diferencia se devuelve en el momento.

---

## 10. Devoluciones y anulaciones

- **Anulación total:** se anula la venta completa.
- **Devolución parcial:** el cliente devuelve una o más prendas y se lleva el dinero (sin llevarse otra prenda). Se trata como anulación parcial de la venta.
- En ambos casos:
  - El stock de las prendas devueltas vuelve.
  - El dinero cobrado se devuelve y se registra como movimiento negativo.
  - En ventas fiadas, primero se reduce la deuda; solo se devuelve dinero si lo pagado supera el nuevo total.
  - El **motivo es obligatorio**.
- Las anulaciones y devoluciones no se borran y figuran en un reporte para el administrador.

---

## 11. Saldo de la tienda

- El efectivo de la tienda **se mezcla** con el resto del dinero de secretaría, y no se hace cierre de caja.
- Por eso el sistema no controla una caja física: lleva un **saldo virtual por medio de pago**:
  - Saldo en efectivo.
  - Saldo en transferencias.
- El saldo en efectivo representa cuánto del dinero de secretaría le corresponde a la tienda.
- El saldo **se calcula siempre como la suma de los movimientos de fondos**; nunca es un valor que se edita a mano.
- **Se permite saldo negativo** en cualquiera de los dos medios, ya que la comisión directiva suele prestarle dinero a la tienda. El sistema muestra una advertencia, pero no bloquea la operación.
- Tipos de movimiento:

| Tipo | Signo |
|---|---|
| Cobro de venta | + |
| Cobro de fiado | + |
| Cobro de diferencia por cambio | + |
| Préstamo recibido de la comisión directiva | + |
| Devolución de diferencia por cambio | − |
| Devolución / anulación | − |
| Egreso | − |
| Devolución de préstamo a la comisión directiva | − |
| Depósito bancario | − efectivo / + transferencia |
| Extracción bancaria | − transferencia / + efectivo |

### 11.1 Préstamos de la comisión directiva

- Cuando la comisión directiva le presta dinero a la tienda, se registra un movimiento **"préstamo recibido"** (+) en el medio correspondiente (efectivo o transferencia).
- Cuando la tienda le devuelve dinero, se registra un movimiento **"devolución de préstamo"** (−).
- Se admiten devoluciones parciales.
- **Deuda con la comisión** = Σ préstamos recibidos − Σ devoluciones de préstamo. Se muestra junto a los saldos.
- Los préstamos **no son ganancia ni venta**: solo afectan el saldo y la deuda con la comisión.

### 11.2 Depósitos y extracciones bancarias

- A veces el efectivo de la tienda **se deposita en el banco** y pasa a estar como transferencia.
- Un depósito se registra como **una sola operación** que genera dos movimientos con el mismo monto:
  - Movimiento negativo en **efectivo**.
  - Movimiento positivo en **transferencia**.
- El **saldo total de la tienda no cambia**: solo pasa dinero de un medio al otro.
- La operación inversa (**extracción**: sacar dinero del banco y pasarlo a efectivo) funciona igual, con los signos invertidos.
- Datos: fecha, monto, tipo (depósito / extracción), descripción y número de comprobante (opcional).
- El monto debe ser mayor a cero. Igual que en los egresos, se permite que el medio de origen quede negativo, con advertencia.
- Los depósitos y extracciones **no son ventas, egresos ni ganancia**.
- No se anulan borrándolos: un error se corrige registrando la operación inversa.

---

## 12. Egresos

- Los pagos de la tienda (mercadería, otros gastos) se hacen **desde secretaría**, en efectivo o transferencia.
- Los registra **secretaría**.
- Datos: fecha, monto, medio, concepto (compra de mercadería / otro gasto), descripción y número de comprobante (opcional).
- Un egreso de compra de mercadería puede referenciar opcionalmente al **ingreso de mercadería** que paga, para saber qué compras están pagas.
- Cada egreso genera un **movimiento de fondos negativo**.

---

## 13. Ganancia

- Ganancia de una venta = Σ (precio unitario vendido − costo unitario) × cantidad.
- El costo unitario es el costo del producto (ver 3.2).
- Cada ítem de venta guarda el **costo unitario congelado** al momento de vender, igual que el precio. Así, si el costo del producto se actualiza más adelante, la ganancia de ventas pasadas no cambia.
- Los ítems devueltos o anulados no cuentan para la ganancia.
- Las prendas devueltas en cambios sin venta registrada vuelven al stock sin afectar el cálculo de costo.

---

## 14. Reportes

- Ventas por período (con detalle por prenda, color y talle).
- Ventas por medio de pago.
- Saldo actual en efectivo y en transferencias, con el detalle de movimientos.
- Deuda con la comisión directiva (préstamos recibidos y devueltos).
- Depósitos y extracciones bancarias por período.
- Stock actual por producto y variante.
- Deudores (fiado) con monto y antigüedad.
- Anulaciones y devoluciones con motivo y usuario.
- Egresos por período.
- **Ganancia** por período, por producto y por variante.

---

## 15. Modelo de datos (borrador)

| Tabla | Contenido principal |
|---|---|
| `usuario` | nombre, rol (secretaria / admin) |
| `producto` | nombre, precio de venta, costo, activo |
| `variante` | producto, talle, color, stock (único por producto + talle + color) |
| `ingreso_mercaderia` | fecha, proveedor, usuario |
| `ingreso_item` | ingreso, variante, cantidad, costo unitario |
| `comprador` | nombre, apodo, teléfono, número de socio (opcional) |
| `venta` | fecha, comprador, usuario, total, estado, motivo de anulación |
| `venta_item` | venta, variante, cantidad, precio unitario, costo unitario, cantidad devuelta |
| `pago` | venta, medio, monto, fecha, usuario |
| `cambio` | venta original, ítem devuelto, variante nueva, diferencia, resolución (cobro / devolución / ajuste de deuda) |
| `egreso` | fecha, monto, medio, concepto, descripción, comprobante, ingreso de mercadería (opcional) |
| `transferencia_medios` | fecha, tipo (depósito / extracción), monto, descripción, comprobante, usuario |
| `movimiento_fondos` | fecha, medio, monto con signo, tipo (incluye préstamos, depósitos y extracciones), referencia a la operación, descripción, usuario |

Todas las tablas operativas guardan usuario y fecha.

---

## 16. Próximos pasos

1. Casos de uso con sus flujos (principal y alternativos).
2. DER detallado con campos, tipos y restricciones para MySQL.
3. Diseño de pantallas, priorizando las de secretaría.
