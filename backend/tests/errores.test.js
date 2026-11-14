import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { AppError } from '../src/utils/AppError.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { notFound } from '../src/middlewares/notFound.js';

/** App de prueba con rutas que fallan de distintas formas. */
function appConErrores() {
  const app = express();
  app.use(express.json());
  app.get('/negocio', () => {
    throw AppError.badRequest('STOCK_INSUFICIENTE', 'No hay stock.', { varianteId: 7 });
  });
  app.get('/async', async () => {
    throw AppError.conflict('PAGO_EXCEDE_TOTAL', 'El pago supera el total.');
  });
  app.get('/zod', () => {
    z.object({ nombre: z.string() }).parse({});
  });
  app.get('/roto', () => {
    throw new Error('detalle interno que no debe salir');
  });
  app.post('/json', (req, res) => res.json(req.body));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe('manejo centralizado de errores', () => {
  it('400: AppError devuelve code, message y details', async () => {
    const res = await request(appConErrores()).get('/negocio');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'STOCK_INSUFICIENTE', message: 'No hay stock.', details: { varianteId: 7 } },
    });
  });

  it('captura errores lanzados en handlers async', async () => {
    const res = await request(appConErrores()).get('/async');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'PAGO_EXCEDE_TOTAL', details: null });
  });

  it('400: un ZodError se traduce a VALIDACION con detalle de campos', async () => {
    const res = await request(appConErrores()).get('/zod');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
    expect(res.body.error.details).toEqual([{ campo: 'nombre', mensaje: expect.any(String) }]);
  });

  it('400: JSON mal formado', async () => {
    const res = await request(appConErrores())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{mal');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('JSON_INVALIDO');
  });

  it('404: ruta inexistente en la API real', async () => {
    const res = await request(createApp()).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'RUTA_NO_ENCONTRADA',
        message: 'Ruta no encontrada: GET /api/no-existe',
        details: null,
      },
    });
  });

  it('500: error inesperado sin filtrar detalles internos', async () => {
    const res = await request(appConErrores()).get('/roto');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado.', details: null },
    });
  });
});
