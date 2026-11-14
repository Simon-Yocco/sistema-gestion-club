import * as service from './compradores.service.js';

export async function listar(req, res) {
  res.json({ compradores: await service.listar(req.validated.query) });
}

export async function obtener(req, res) {
  res.json({ comprador: await service.obtener(req.validated.params.id) });
}

export async function crear(req, res) {
  const comprador = await service.crear(req.body);
  res.status(201).json({ comprador: service.serializar(comprador) });
}

export async function editar(req, res) {
  res.json({ comprador: await service.editar(req.validated.params.id, req.body) });
}
