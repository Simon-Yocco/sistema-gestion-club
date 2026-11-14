# DER – Sistema de ventas de la tienda del club

Generado a partir de las migraciones de `backend/src/migrations/` (fase 2). Si cambia una migración, hay que actualizar este documento.

Convenciones:
- Todas las tablas tienen `id INT UNSIGNED` autoincremental y `created_at`. Las de catálogo (`usuario`, `producto`, `variante`, `comprador`) tienen además `updated_at`.
- Dinero en `DECIMAL(12,2)`. Fechas en UTC.
- Todas las claves foráneas son `ON DELETE RESTRICT`: **nada se borra** (principio 1).
- El saldo, el total de la venta, la deuda y el estado de pago **no se guardan**: se calculan (principios 5 y 6).

```mermaid
erDiagram
    usuario {
        int id PK
        varchar nombre
        varchar username UK
        varchar password_hash
        enum rol "secretaria | admin"
        bool activo
    }

    producto {
        int id PK
        varchar nombre UK
        text descripcion
        decimal precio_venta
        decimal costo
        bool activo
    }

    variante {
        int id PK
        int producto_id FK
        varchar talle "UK con producto y color"
        varchar color
        int stock "UNSIGNED, nunca negativo"
        bool activo
    }

    comprador {
        int id PK
        varchar nombre
        varchar apodo "nullable"
        varchar numero_socio UK "nullable, hoy sin uso"
        varchar telefono "nullable, obligatorio para fiado"
    }

    ingreso_mercaderia {
        int id PK
        date fecha
        varchar proveedor "nullable"
        text observaciones
        int usuario_id FK
    }

    ingreso_item {
        int id PK
        int ingreso_id FK
        int variante_id FK
        int cantidad "mayor a 0"
        decimal costo_unitario "copiado del producto"
    }

    venta {
        int id PK
        datetime fecha
        int comprador_id FK "nullable"
        int usuario_id FK
        enum estado "activa | anulada"
        text motivo_anulacion
        int anulada_por FK
        datetime anulada_at
    }

    venta_item {
        int id PK
        int venta_id FK
        int variante_id FK
        int cantidad "mayor a 0"
        decimal precio_unitario "congelado"
        decimal costo_unitario "congelado"
        int cantidad_devuelta "hasta cantidad"
        enum origen "venta | cambio"
    }

    pago {
        int id PK
        int venta_id FK
        enum medio "efectivo | transferencia, null en credito_cambio"
        decimal monto "cobro y credito positivos, devolucion negativo"
        enum tipo "cobro | devolucion | credito_cambio"
        datetime fecha
        int usuario_id FK
    }

    devolucion {
        int id PK
        int venta_id FK
        enum tipo "devolucion | anulacion"
        text motivo "obligatorio"
        datetime fecha
        int usuario_id FK
    }

    devolucion_item {
        int id PK
        int devolucion_id FK
        int venta_item_id FK
        int cantidad "mayor a 0"
    }

    cambio {
        int id PK
        int venta_id FK "venta del cambio (en sin venta: la nueva)"
        int venta_item_devuelto_id FK "null si no hay venta registrada"
        int variante_devuelta_id FK
        int cantidad_devuelta
        decimal valor_devuelto
        int venta_item_nuevo_id FK
        int cantidad_nueva
        decimal valor_nuevo
        decimal diferencia "nuevo menos devuelto"
        enum resolucion "sin_diferencia | cobro | devolucion | ajuste_deuda"
        text motivo
        datetime fecha
        int usuario_id FK
    }

    egreso {
        int id PK
        date fecha
        decimal monto "mayor a 0"
        enum medio
        enum concepto "mercaderia | otro"
        text descripcion
        varchar comprobante
        int ingreso_mercaderia_id FK "nullable"
        int usuario_id FK
    }

    transferencia_medios {
        int id PK
        date fecha
        enum tipo "deposito | extraccion"
        decimal monto "mayor a 0"
        text descripcion
        varchar comprobante
        int usuario_id FK
    }

    movimiento_fondos {
        int id PK
        datetime fecha
        enum medio "efectivo | transferencia"
        decimal monto "con signo, distinto de 0"
        enum tipo
        varchar referencia_tipo
        int referencia_id
        varchar descripcion
        int usuario_id FK
    }

    producto ||--o{ variante : "tiene"
    ingreso_mercaderia ||--|{ ingreso_item : "tiene"
    variante ||--o{ ingreso_item : "ingresa"
    ingreso_mercaderia ||--o{ egreso : "se paga con"

    comprador |o--o{ venta : "compra"
    venta ||--|{ venta_item : "tiene"
    variante ||--o{ venta_item : "se vende"
    venta ||--o{ pago : "tiene"
    venta ||--o{ devolucion : "tiene"
    devolucion ||--|{ devolucion_item : "tiene"
    venta_item ||--o{ devolucion_item : "se devuelve"

    venta |o--o{ cambio : "tiene"
    venta_item |o--o{ cambio : "item devuelto"
    venta_item ||--o{ cambio : "item nuevo"
    variante ||--o{ cambio : "variante devuelta"

    usuario ||--o{ venta : "registra"
    usuario ||--o{ pago : "registra"
    usuario ||--o{ movimiento_fondos : "registra"
```

Por claridad, el diagrama no muestra todas las relaciones con `usuario`. Todas las tablas operativas (`ingreso_mercaderia`, `venta`, `pago`, `devolucion`, `cambio`, `egreso`, `transferencia_medios` y `movimiento_fondos`) tienen `usuario_id`, y `venta.anulada_por` también apunta a `usuario`.

## `movimiento_fondos`

Es el libro de caja virtual: el saldo de cada medio es `SUM(monto) WHERE medio = ?`.

| `tipo` | Signo | Medio | `referencia_tipo` |
|---|---|---|---|
| `cobro_venta` | + | el del pago | `pago` |
| `cobro_fiado` | + | el del pago | `pago` |
| `cobro_diferencia_cambio` | + | el del pago | `pago` |
| `devolucion_diferencia_cambio` | − | el del reintegro | `pago` |
| `devolucion_anulacion` | − | el del reintegro | `pago` |
| `egreso` | − | el del egreso | `egreso` |
| `prestamo_recibido` | + | el elegido | — |
| `devolucion_prestamo` | − | el elegido | — |
| `deposito_bancario` | − efectivo / + transferencia | ambos (2 filas) | `transferencia_medios` |
| `extraccion_bancaria` | − transferencia / + efectivo | ambos (2 filas) | `transferencia_medios` |
| `saldo_inicial` | ± | el elegido | — (arranque, tarea 17.2) |

Deuda con la comisión directiva = Σ `prestamo_recibido` − |Σ `devolucion_prestamo`|.

## Restricciones CHECK

| Tabla | Regla |
|---|---|
| `producto` | `precio_venta >= 0 AND costo >= 0` |
| `ingreso_item` | `cantidad > 0 AND costo_unitario >= 0` |
| `venta_item` | `cantidad > 0 AND cantidad_devuelta <= cantidad`, precio y costo `>= 0` |
| `pago` | cobro con `monto > 0` y medio; devolución con `monto < 0` y medio; crédito de cambio con `monto > 0` y sin medio |
| `devolucion` | motivo no vacío |
| `devolucion_item` | `cantidad > 0` |
| `cambio` | cantidades `> 0`, valores `>= 0`, `diferencia = valor_nuevo − valor_devuelto` |
| `egreso`, `transferencia_medios` | `monto > 0` |
| `movimiento_fondos` | `monto <> 0` |

## Diferencias con el borrador de las reglas (sección 15)

- `venta` no guarda `total`: se calcula de los ítems (principio 6).
- Se agregan `devolucion` y `devolucion_item` (tarea 2.10). `devolucion.tipo` distingue una devolución parcial de una anulación, para el reporte 11.5.
- `cambio` guarda cantidades y valores de cada lado (`cantidad_devuelta` / `cantidad_nueva`, `valor_devuelto` / `valor_nuevo`).
- `movimiento_fondos.tipo` suma `saldo_inicial`, para cargar el dinero con el que arranca la tienda (17.2).
- `comprador.apodo` (reglas v1.2): los compradores se conocen por nombre o apodo; para fiado hace falta el teléfono.

## Cómo se registran los cambios de prenda

- **Con venta registrada (9.1):** en la misma venta, el ítem original suma `cantidad_devuelta` y se agrega un ítem nuevo con `origen = 'cambio'`, a precio y costo actuales. La diferencia se cobra (pagos `cobro`, movimiento `cobro_diferencia_cambio`), se devuelve (pago `devolucion`, movimiento `devolucion_diferencia_cambio`) o ajusta la deuda (sin pagos).
- **Sin venta registrada (9.2):** se crea una **venta nueva** con el ítem nuevo. El valor de la prenda devuelta (a precio actual) entra como pago `credito_cambio`, **sin medio y sin movimiento de fondos**: cuenta como pagado, pero no es dinero que entra ni aparece en los saldos ni en las ventas por medio de pago. `cambio.venta_id` apunta a la venta nueva y `venta_item_devuelto_id` queda en NULL.
