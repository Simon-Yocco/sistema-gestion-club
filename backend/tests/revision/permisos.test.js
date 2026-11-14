// 15.2 Revisión de permisos: recorre TODOS los endpoints de la API y verifica que
//  - sin sesión responden 401 (salvo los públicos);
//  - con rol secretaría, los que exigen una acción de admin responden 403, y los de
//    secretaría no responden 403;
//  - ningún endpoint de negocio quedó sin permiso declarado.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { puede } from '../../src/config/permisos.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { listarEndpoints, conParametros, PUBLICOS } from '../helpers/endpoints.js';

const endpoints = listarEndpoints();
const nombre = (e) => `${e.metodo.toUpperCase()} ${e.ruta}`;
const llamar = (agente, e) => agente[e.metodo](conParametros(e.ruta)).send({});

describe('revisión de permisos de todos los endpoints', () => {
  it('se encontraron los endpoints de la API', () => {
    expect(endpoints.length).toBeGreaterThan(50);
  });

  it('todo endpoint no público declara al menos una acción de permiso (o es de auth)', () => {
    const sinPermiso = endpoints
      .filter((e) => !PUBLICOS.includes(nombre(e)) && e.acciones.length === 0)
      .map(nombre);
    // /auth/me solo exige sesión: no es un endpoint de negocio.
    expect(sinPermiso).toEqual(['GET /api/auth/me']);
  });

  it('sin sesión → 401 en todos los endpoints no públicos', async () => {
    const app = createApp();
    const fallas = [];
    for (const e of endpoints.filter((x) => !PUBLICOS.includes(nombre(x)))) {
      const res = await llamar(request(app), e);
      if (res.status !== 401) fallas.push(`${nombre(e)} → ${res.status}`);
    }
    expect(fallas).toEqual([]);
  });

  it('secretaría → 403 en los de admin; nunca 403 en los suyos', async () => {
    const { agent } = await loginComoSecretaria();
    const fallas = [];
    for (const e of endpoints.filter((x) => x.acciones.length > 0)) {
      const permitido = e.acciones.every((a) => puede('secretaria', a));
      const res = await llamar(agent, e);
      if (!permitido && res.status !== 403)
        fallas.push(`${nombre(e)} debería ser 403 y dio ${res.status}`);
      if (permitido && res.status === 403) fallas.push(`${nombre(e)} no debería ser 403`);
    }
    expect(fallas).toEqual([]);
  });
});
