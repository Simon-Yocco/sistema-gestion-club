import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearComprador } from '../helpers/factories.js';

describe('ABM de compradores', () => {
  it('crea un comprador con solo el nombre: sirve para ventas pagadas, no para fiar', async () => {
    const { agent } = await loginComoSecretaria();
    const res = await agent.post('/api/compradores').send({ nombre: '  Juan Gómez ' });

    expect(res.status).toBe(201);
    expect(res.body.comprador).toMatchObject({
      nombre: 'Juan Gómez',
      apodo: null,
      etiqueta: 'Juan Gómez',
      numero_socio: null,
      telefono: null,
      puede_fiar: false,
    });
  });

  it('con apodo y teléfono: se muestra con el apodo y puede llevar fiado', async () => {
    const { agent } = await loginComoSecretaria();
    const res = await agent
      .post('/api/compradores')
      .send({ nombre: 'Juan Pérez', apodo: 'el Turco', telefono: '+54 9 11 5555-1234' });

    expect(res.body.comprador).toMatchObject({
      apodo: 'el Turco',
      etiqueta: 'Juan Pérez ("el Turco")',
      puede_fiar: true,
    });
  });

  it('el número de socio solo no alcanza para fiar (reglas v1.2)', async () => {
    const { agent } = await loginComoSecretaria();
    const res = await agent.post('/api/compradores').send({ nombre: 'Ana', numero_socio: '1234' });
    expect(res.body.comprador).toMatchObject({ numero_socio: '1234', puede_fiar: false });
  });

  it('número de socio opcional pero único si se carga (vacío se guarda como null)', async () => {
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

  it('edita (agregar teléfono habilita el fiado; apodo vacío lo borra) y obtiene', async () => {
    const { agent } = await loginComoSecretaria();
    const c = await crearComprador({ nombre: 'Viejo', apodo: 'Tito', telefono: null });

    const editado = await agent
      .patch(`/api/compradores/${c.id}`)
      .send({ telefono: '1155551234', apodo: '' });
    expect(editado.body.comprador).toMatchObject({
      nombre: 'Viejo',
      apodo: null,
      telefono: '1155551234',
      puede_fiar: true,
    });

    const leido = await agent.get(`/api/compradores/${c.id}`);
    expect(leido.body.comprador.puede_fiar).toBe(true);
  });

  it('validaciones y errores', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await agent.post('/api/compradores').send({ nombre: '' })).status).toBe(400);
    expect(
      (await agent.post('/api/compradores').send({ nombre: 'X', telefono: 'abc' })).status,
    ).toBe(400);
    expect(
      (await agent.post('/api/compradores').send({ nombre: 'X', apodo: 'a'.repeat(61) })).status,
    ).toBe(400);
    expect((await agent.get('/api/compradores/99999')).status).toBe(404);
    expect((await agent.patch('/api/compradores/99999').send({ nombre: 'X' })).status).toBe(404);
    expect((await request(createApp()).get('/api/compradores')).status).toBe(401);
  });
});
