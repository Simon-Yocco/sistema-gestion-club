import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../src/middlewares/validate.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

function appDePrueba() {
  const app = express();
  app.use(express.json());
  app.post(
    '/items/:id',
    validate({
      params: z.object({ id: z.coerce.number().int().positive() }),
      query: z.object({ modo: z.enum(['rapido', 'lento']).default('rapido') }),
      body: z.object({
        nombre: z.string().trim().min(1),
        cantidad: z.number().int().positive(),
      }),
    }),
    (req, res) => res.json(req.validated),
  );
  app.use(errorHandler);
  return app;
}

describe('validate(schema)', () => {
  it('deja pasar datos válidos y expone los valores parseados', async () => {
    const res = await request(appDePrueba())
      .post('/items/5')
      .send({ nombre: '  Remera ', cantidad: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      params: { id: 5 },
      query: { modo: 'rapido' },
      body: { nombre: 'Remera', cantidad: 2 },
    });
  });

  it('body inválido → 400 con detalle de cada campo', async () => {
    const res = await request(appDePrueba()).post('/items/5').send({ nombre: '', cantidad: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
    const campos = res.body.error.details.map((d) => d.campo);
    expect(campos).toEqual(['body.nombre', 'body.cantidad']);
  });

  it('reporta errores de params, query y body juntos', async () => {
    const res = await request(appDePrueba()).post('/items/abc?modo=volando').send({});

    expect(res.status).toBe(400);
    const campos = res.body.error.details.map((d) => d.campo);
    expect(campos).toEqual(
      expect.arrayContaining(['params.id', 'query.modo', 'body.nombre', 'body.cantidad']),
    );
  });

  it('sin body → valida contra objeto vacío', async () => {
    const res = await request(appDePrueba()).post('/items/1');
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.campo)).toEqual(['body.nombre', 'body.cantidad']);
  });
});
