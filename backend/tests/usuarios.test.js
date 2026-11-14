import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Usuario } from '../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from './helpers/auth.js';
import { crearUsuario } from './helpers/factories.js';

const nuevo = {
  nombre: 'Ana Pérez',
  username: 'Ana.Perez',
  password: 'clave-segura',
  rol: 'secretaria',
};

describe('ABM de usuarios', () => {
  describe('permisos', () => {
    it('sin sesión → 401', async () => {
      expect((await request(createApp()).get('/api/usuarios')).status).toBe(401);
    });

    it('secretaría → 403 en todos los endpoints', async () => {
      const { agent } = await loginComoSecretaria();
      const otro = await crearUsuario();
      const respuestas = await Promise.all([
        agent.get('/api/usuarios'),
        agent.get(`/api/usuarios/${otro.id}`),
        agent.post('/api/usuarios').send(nuevo),
        agent.patch(`/api/usuarios/${otro.id}`).send({ activo: false }),
        agent.post(`/api/usuarios/${otro.id}/password`).send({ password: 'nueva-clave' }),
      ]);
      expect(respuestas.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    });
  });

  describe('crear', () => {
    it('crea un usuario (username en minúsculas) sin devolver el hash', async () => {
      const { agent } = await loginComoAdmin();
      const res = await agent.post('/api/usuarios').send(nuevo);

      expect(res.status).toBe(201);
      expect(res.body.usuario).toMatchObject({
        nombre: 'Ana Pérez',
        username: 'ana.perez',
        rol: 'secretaria',
        activo: true,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(JSON.stringify(res.body)).not.toContain('hash');

      // y puede iniciar sesión
      const login = await request(createApp())
        .post('/api/auth/login')
        .send({ username: 'ana.perez', password: 'clave-segura' });
      expect(login.status).toBe(200);
    });

    it('username repetido → 409 USERNAME_EN_USO', async () => {
      const { agent } = await loginComoAdmin();
      await crearUsuario({ username: 'ana.perez' });
      const res = await agent.post('/api/usuarios').send(nuevo);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_EN_USO');
    });

    it('valida contraseña corta, rol inválido y username con espacios', async () => {
      const { agent } = await loginComoAdmin();
      const res = await agent
        .post('/api/usuarios')
        .send({ nombre: 'X', username: 'ana perez', password: '123', rol: 'jefe' });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.campo).sort()).toEqual([
        'body.password',
        'body.rol',
        'body.username',
      ]);
    });
  });

  describe('listar y obtener', () => {
    it('lista ordenado por nombre y filtra por activo', async () => {
      const { agent, usuario: admin } = await loginComoAdmin({ nombre: 'Zoe' });
      await crearUsuario({ nombre: 'Bruno' });
      await crearUsuario({ nombre: 'Ana', activo: false });

      const todos = await agent.get('/api/usuarios');
      expect(todos.body.usuarios.map((u) => u.nombre)).toEqual(['Ana', 'Bruno', 'Zoe']);

      const activos = await agent.get('/api/usuarios?activo=true');
      expect(activos.body.usuarios.map((u) => u.nombre)).toEqual(['Bruno', 'Zoe']);

      const uno = await agent.get(`/api/usuarios/${admin.id}`);
      expect(uno.body.usuario).toMatchObject({ id: admin.id, nombre: 'Zoe', rol: 'admin' });
    });

    it('id inexistente → 404', async () => {
      const { agent } = await loginComoAdmin();
      const res = await agent.get('/api/usuarios/99999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USUARIO_NO_ENCONTRADO');
    });
  });

  describe('editar', () => {
    it('edita nombre y rol, y desactiva/activa (sin borrar)', async () => {
      const { agent } = await loginComoAdmin();
      const otro = await crearUsuario({ nombre: 'Viejo' });

      const editado = await agent
        .patch(`/api/usuarios/${otro.id}`)
        .send({ nombre: 'Nuevo', rol: 'admin' });
      expect(editado.status).toBe(200);
      expect(editado.body.usuario).toMatchObject({ nombre: 'Nuevo', rol: 'admin' });

      await agent.patch(`/api/usuarios/${otro.id}`).send({ activo: false }).expect(200);
      expect((await Usuario.findByPk(otro.id)).activo).toBe(false);

      await agent.patch(`/api/usuarios/${otro.id}`).send({ activo: true }).expect(200);
      expect((await Usuario.findByPk(otro.id)).activo).toBe(true);
    });

    it('el admin no puede desactivarse ni cambiarse el rol a sí mismo', async () => {
      const { agent, usuario } = await loginComoAdmin();

      const desactivar = await agent.patch(`/api/usuarios/${usuario.id}`).send({ activo: false });
      expect(desactivar.status).toBe(409);
      expect(desactivar.body.error.code).toBe('OPERACION_SOBRE_SI_MISMO');

      const cambiarRol = await agent
        .patch(`/api/usuarios/${usuario.id}`)
        .send({ rol: 'secretaria' });
      expect(cambiarRol.status).toBe(409);

      // pero sí puede cambiar su nombre
      await agent.patch(`/api/usuarios/${usuario.id}`).send({ nombre: 'Yo' }).expect(200);
    });

    it('body vacío o con campos desconocidos → 400', async () => {
      const { agent } = await loginComoAdmin();
      const otro = await crearUsuario();
      expect((await agent.patch(`/api/usuarios/${otro.id}`).send({})).status).toBe(400);
      expect(
        (await agent.patch(`/api/usuarios/${otro.id}`).send({ password_hash: 'x' })).status,
      ).toBe(400);
    });

    it('username repetido al editar → 409', async () => {
      const { agent } = await loginComoAdmin();
      await crearUsuario({ username: 'tomado' });
      const otro = await crearUsuario();
      const res = await agent.patch(`/api/usuarios/${otro.id}`).send({ username: 'TOMADO' });
      expect(res.status).toBe(409);
    });
  });

  describe('resetear contraseña', () => {
    it('la contraseña nueva funciona y la vieja no', async () => {
      const { agent } = await loginComoAdmin();
      const otro = await crearUsuario({ username: 'olvidadiza' });

      await agent
        .post(`/api/usuarios/${otro.id}/password`)
        .send({ password: 'clave-nueva-1' })
        .expect(204);

      const app = createApp();
      const conNueva = await request(app)
        .post('/api/auth/login')
        .send({ username: 'olvidadiza', password: 'clave-nueva-1' });
      const conVieja = await request(app)
        .post('/api/auth/login')
        .send({ username: 'olvidadiza', password: 'clave-de-test' });
      expect(conNueva.status).toBe(200);
      expect(conVieja.status).toBe(401);
    });
  });

  it('no existe DELETE', async () => {
    const { agent } = await loginComoAdmin();
    const otro = await crearUsuario();
    expect((await agent.delete(`/api/usuarios/${otro.id}`)).status).toBe(404);
    expect(await Usuario.findByPk(otro.id)).not.toBeNull();
  });
});
