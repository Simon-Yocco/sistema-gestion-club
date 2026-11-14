# Helpers de tests

- `db.js`: `truncateAll()` vacía la base de test. Se llama automáticamente antes de cada test (`tests/setup/setupEach.js`).
- Las fábricas de datos de prueba (usuario, producto con variantes, comprador) se agregan en la fase 2, cuando existan los modelos (`factories.js`).
