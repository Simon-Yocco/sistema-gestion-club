import { describe, it, expect } from 'vitest';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearComprador } from '../helpers/factories.js';

async function escenario() {
  await crearComprador({ nombre: 'Martín López', numero_socio: '150', telefono: '11 5555-1234' });
  await crearComprador({ nombre: 'Ana Martínez', numero_socio: '1500', telefono: null });
  await crearComprador({ nombre: 'Marta Ruiz', numero_socio: null, telefono: '+54 351 444-9999' });
  await crearComprador({ nombre: 'Pedro Sosa', numero_socio: '20', telefono: null });
}

const nombres = (res) => res.body.compradores.map((c) => c.nombre);

describe('GET /api/compradores?q= (búsqueda rápida)', () => {
  it('busca por nombre; primero los que empiezan con el texto', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    const res = await agent.get('/api/compradores?q=mart');
    expect(nombres(res)).toEqual(['Marta Ruiz', 'Martín López', 'Ana Martínez']);
  });

  it('busca por número de socio; el socio exacto va primero', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    const res = await agent.get('/api/compradores?q=150');
    expect(nombres(res)).toEqual(['Martín López', 'Ana Martínez']);
  });

  it('busca por teléfono comparando solo dígitos', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    expect(nombres(await agent.get('/api/compradores?q=5555 1234'))).toEqual(['Martín López']);
    expect(nombres(await agent.get('/api/compradores?q=444-9999'))).toEqual(['Marta Ruiz']);
  });

  it('respeta el límite y sin q lista alfabéticamente', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();
    expect(nombres(await agent.get('/api/compradores?q=mart&limite=1'))).toEqual(['Marta Ruiz']);
    expect(nombres(await agent.get('/api/compradores'))).toEqual([
      'Ana Martínez',
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
