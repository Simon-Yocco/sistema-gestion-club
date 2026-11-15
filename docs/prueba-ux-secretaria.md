# Prueba de uso con secretaría (tarea 15.4)

Objetivo: que alguien de secretaría que **no conozca el sistema** haga las tareas de todos los días sin ayuda, y anotar dónde duda, se equivoca o tarda. Lo que se encuentre se corrige antes del arranque (fase 17).

## Preparación (10 minutos, la hace quien coordina)

1. Levantar el sistema con datos de prueba (no los reales):
   ```
   npm --prefix backend run migrate
   npm --prefix backend run seed
   npm --prefix backend run dev
   npm --prefix frontend run dev
   ```
2. Abrir `http://localhost:5173` en la computadora (o el celular/tablet) que se va a usar en secretaría.
3. Usuario: `secretaria` / `secretaria1234`.
4. Explicarle solo esto: *"Es el sistema para vender la ropa del club. Te voy a pedir unas tareas; hacelas como te parezca. Pensá en voz alta. Si te trabás, no es tu culpa: es lo que queremos encontrar."*
5. **No ayudar** salvo que pasen más de 2 minutos trabada. Anotar todo.

## Tareas (leerlas de a una)

| # | Tarea | Qué mirar |
|---|---|---|
| 1 | Entrá al sistema. | ¿Encuentra dónde poner usuario y contraseña? |
| 2 | Vendé una remera titular azul talle M, que te pagan en efectivo. | ¿Encuentra la grilla de talles? ¿Usa "Todo en efectivo"? Contar clics. |
| 3 | Vendé un buzo que te pagan $20.000 en efectivo y el resto por transferencia. | ¿Entiende "+ Agregar pago"? ¿Escribe bien los montos? |
| 4 | Juan Pérez, "el Turco", se lleva un short y lo paga la semana que viene. Su teléfono es 11 5555 1234. | ¿Entiende que tiene que cargar el comprador? ¿Ve el aviso de fiado? |
| 5 | Juan vino a pagar el short. | ¿Lo encuentra por "Deudores" o por "Ventas"? ¿Encuentra "Cobrar"? |
| 6 | El que compró la remera en la tarea 2 la quiere cambiar por un talle L. | ¿Encuentra la venta? ¿Entiende el mensaje de la diferencia? |
| 7 | Otra persona devuelve una de dos remeras que compró y quiere la plata. | ¿Encuentra "Devolver"? ¿Entiende cuánto tiene que devolver y en qué medio? |
| 8 | La venta de la tarea 3 se cargó por error: anulala. | ¿Le parece claro que no se puede deshacer? |
| 9 | Pagaste $5.000 de bolsas en efectivo. Registralo. | ¿Encuentra "Egresos"? ¿Entiende el aviso si el saldo queda negativo? |
| 10 | Depositaste $10.000 del efectivo en el banco. | ¿Encuentra "Depósitos"? |
| 11 | ¿Cuánta plata de la tienda hay en efectivo ahora? | ¿Ve el indicador de saldos? |
| 12 | ¿Quedan buzos grises talle L? ¿Cuánto sale el short? | ¿Encuentra "Prendas"? |

## Planilla para anotar

| # | ¿Lo hizo sola? (sí / con ayuda / no) | Tiempo | Dudas, errores, comentarios textuales |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
| 11 | | | |
| 12 | | | |

## Al final, preguntarle

- ¿Qué fue lo más difícil? ¿Qué cambiarías?
- ¿Hay algún nombre o botón que no se entendía?
- ¿Lo vas a usar en la computadora, en el celular o en una tablet?
- ¿Te animás a usarlo mañana con clientes de verdad?

## Después

Pasar las anotaciones a una lista de cambios (por ejemplo, en un issue de GitHub) y priorizar lo que haya trabado en las tareas 2 a 5, que son las más frecuentes.
