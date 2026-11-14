# Módulos

Un módulo por dominio (productos, ventas, compradores, etc.):

```
<modulo>/
  <modulo>.routes.js      rutas Express y middlewares (auth, permisos, validación)
  <modulo>.controller.js  traduce HTTP ↔ service; sin lógica de negocio
  <modulo>.service.js     lógica de negocio y transacciones
  <modulo>.schemas.js     esquemas Zod
```

Cada router se monta en `src/routes.js`.
