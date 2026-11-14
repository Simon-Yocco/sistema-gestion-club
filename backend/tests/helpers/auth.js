import request from 'supertest';
import { createApp } from '../../src/app.js';
import { crearUsuario, PASSWORD_TEST } from './factories.js';

/**
 * Devuelve un agente de Supertest con la sesión iniciada (guarda la cookie).
 *
 *   const { agent, usuario } = await loginComo({ rol: 'admin' });
 *   await agent.get('/api/usuarios').expect(200);
 */
export async function loginComo(overrides = {}, app = createApp()) {
  const usuario = await crearUsuario(overrides);
  const agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .send({ username: usuario.username, password: PASSWORD_TEST })
    .expect(200);
  return { agent, usuario, app };
}

export const loginComoAdmin = (overrides = {}) => loginComo({ rol: 'admin', ...overrides });
export const loginComoSecretaria = (overrides = {}) =>
  loginComo({ rol: 'secretaria', ...overrides });
