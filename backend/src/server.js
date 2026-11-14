import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

async function main() {
  const db = await connectDb();
  console.log(`Conectado a MySQL: ${db.database} en ${db.host}:${db.port}`);

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(`\nError al iniciar el servidor:\n${err.message}\n`);
  process.exit(1);
});
