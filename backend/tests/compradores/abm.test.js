import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearComprador } from '../helpers/factories.js';

describe('ABM de compradores', () => {
  it('secretaría crea un comprador con solo el nombre (no identificable)', async () => {
    const { agent } = await loginComoSecretaria();
    const res = await agent.post('/api/compradores').send({ nombre: '  Juan Gómez ' });

    expect(res.status).toBe(201);
    expect(res.body.comprador).toMatchObject({
      nombre: 'Juan Gómez',
      numero_socio: null,
      telefono: null,
      identificable: false,
    });
  });

  it('con socio o teléfono es identificable (para fiado)', async () => {
    const { agent } = await loginComoSecretaria();
    const conSocio = await agent
      .post('/api/compradores')
      .send({ nombre: 'Ana', numero_socio: '1234' });
    const conTel = await agent
      .post('/api/compradores')
      .send({ nombre: 'Luis', telefono: '+54 9 11 5555-1234' });
    expect(conSocio.body.comprador.identificable).toBe(true);
    expect(conTel.body.comprador.identificable).toBe(true);
  });

  it('número de socio único si se carga (vacío se guarda como null y no choca)', async () => {
    const { agent } = await loginComoSecretaria();
    await crearComprador({ numero_socio: '777' });

    const repetido = await agent
      .post('/api/compradores')
      .send({ nombre: 'X', numero_socio: '777' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe('SOCIO_DUPLICADO');

    await agent
      .post('/api/compradores')
      .send({ nombre: 'Sin socio 1', numero_socio: '' })
      .expect(201);
    await agent
      .post('/api/compradores')
      .send({ nombre: 'Sin socio 2', numero_socio: '' })
      .expect(201);
  });

  it('edita y obtiene', async () => {
    const { agent } = await loginComoSecretaria();
    const c = await crearComprador({ nombre: 'Viejo', numero_socio: null });

    const editado = await agent.patch(`/api/compradores/${c.id}`).send({ telefono: '1155551234' });
    expect(editado.body.comprador).toMatchObject({ nombre: 'Viejo', telefono: '1155551234' });

    const leido = await agent.get(`/api/compradores/${c.id}`);
    expect(leido.body.comprador.identificable).toBe(true);
  });

  it('validaciones y errores', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await agent.post('/api/compradores').send({ nombre: '' })).status).toBe(400);
    expect(
      (await agent.post('/api/compradores').send({ nombre: 'X', telefono: 'abc' })).status,
    ).toBe(400);
    expect((await agent.get('/api/compradores/99999')).status).toBe(404);
    expect((await agent.patch('/api/compradores/99999').send({ nombre: 'X' })).status).toBe(404);
    expect((await request(createApp()).get('/api/compradores')).status).toBe(401);
  });
});
