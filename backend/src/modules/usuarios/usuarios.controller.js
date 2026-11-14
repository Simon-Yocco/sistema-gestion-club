import * as service from './usuarios.service.js';

export async function listar(req, res) {
  res.json({ usuarios: await service.listar(req.validated.query) });
}

export async function obtener(req, res) {
  res.json({ usuario: await service.obtener(req.validated.params.id) });
}

export async function crear(req, res) {
  res.status(201).json({ usuario: await service.crear(req.body) });
}

export async function editar(req, res) {
  res.json({ usuario: await service.editar(req.validated.params.id, req.body, req.user) });
}

export async function resetearPassword(req, res) {
  await service.resetearPassword(req.validated.params.id, req.body.password);
  res.status(204).end();
}
