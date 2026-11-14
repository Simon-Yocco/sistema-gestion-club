import { describe, it, expect } from 'vitest';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearComprador } from '../helpers/factories.js';

async function escenario() {
  await crearComprador({ nombre: 'Martín López', apodo: 'el Turco', telefono: '11 5555-1234' });
  await crearComprador({ nombre: 'Ana Martínez', apodo: null, telefono: null });
  await crearComprador({ nombre: 'Marta Ruiz', apodo: 'Chiche', telefono: '+54 351 444-9999' });
  await crearComprador({ nombre: 'Pedro Sosa', apodo: 'Turquito', telefono: null });
  await crearComprador({ nombre: 'Juan Gómez', apodo: null, telefono: null, numero_socio: '150' });
}

const nombres = (res) => res.body.compradores.map((c) => c.nombre);

describe('GET /api/compradores?q= (búsqueda rápida)', () => {
  it('busca por nombre; primero los que tienen una palabra que empieza con el texto', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    const res = await agent.get('/api/compradores?q=mart');
    expect(nombres(res)).toEqual(['Ana Martínez', 'Marta Ruiz', 'Martín López']);
  });

  it('busca por apodo (también por una palabra del medio del apodo)', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    expect(nombres(await agent.get('/api/compradores?q=tur'))).toEqual([
      'Martín López',
      'Pedro Sosa',
    ]);
    const res = await agent.get('/api/compradores?q=chiche');
    expect(res.body.compradores).toEqual([
      expect.objectContaining({ nombre: 'Marta Ruiz', etiqueta: 'Marta Ruiz ("Chiche")' }),
    ]);
  });

  it('las coincidencias al inicio de una palabra van antes que las del medio', async () => {
    const { agent } = await loginComoSecretaria();
    await crearComprador({ nombre: 'Rosa Altuna' }); // "tu" en el medio de una palabra
    await crearComprador({ nombre: 'Tulio Díaz' }); // "tu" al inicio
    expect(nombres(await agent.get('/api/compradores?q=tu'))).toEqual([
      'Tulio Díaz',
      'Rosa Altuna',
    ]);
  });

  it('busca por teléfono comparando solo dígitos', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    expect(nombres(await agent.get('/api/compradores?q=5555 1234'))).toEqual(['Martín López']);
    expect(nombres(await agent.get('/api/compradores?q=444-9999'))).toEqual(['Marta Ruiz']);
  });

  it('también encuentra por número de socio, si está cargado', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    expect(nombres(await agent.get('/api/compradores?q=150'))).toEqual(['Juan Gómez']);
  });

  it('respeta el límite y sin q lista alfabéticamente', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    expect(nombres(await agent.get('/api/compradores?q=mart&limite=1'))).toEqual(['Ana Martínez']);
    expect(nombres(await agent.get('/api/compradores'))).toEqual([
      'Ana Martínez',
      'Juan Gómez',
      'Marta Ruiz',
      'Martín López',
      'Pedro Sosa',
    ]);
  });

  it('sin resultados y texto con comodines o comillas', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    expect(nombres(await agent.get('/api/compradores?q=zzz'))).toEqual([]);
    expect(nombres(await agent.get('/api/compradores?q=%25'))).toEqual([]);
    expect((await agent.get("/api/compradores?q=O'Brien")).status).toBe(200);
  });
});
