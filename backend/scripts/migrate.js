// Uso: npm run migrate | npm run migrate:down | npm run migrate:status
import { createUmzug } from '../src/config/umzug.js';
import { connectDb, closeDb } from '../src/config/db.js';

const accion = process.argv[2] ?? 'up';

try {
  const { database } = await connectDb();
  console.log(`Base: ${database}`);
  const umzug = createUmzug('migrations');

  if (accion === 'up') {
    const hechas = await umzug.up();
    console.log(hechas.length ? `Aplicadas: ${hechas.length}` : 'No hay migraciones pendientes.');
  } else if (accion === 'down') {
    const revertidas = await umzug.down();
    console.log(
      revertidas.length ? `Revertida: ${revertidas[0].name}` : 'No hay nada para revertir.',
    );
  } else if (accion === 'status') {
    const ejecutadas = await umzug.executed();
    const pendientes = await umzug.pending();
    console.log(
      'Ejecutadas:',
      ejecutadas.map((m) => m.name),
    );
    console.log(
      'Pendientes:',
      pendientes.map((m) => m.name),
    );
  } else {
    throw new Error(`Acción desconocida: ${accion} (usar up, down o status)`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
