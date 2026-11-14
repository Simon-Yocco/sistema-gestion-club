import * as service from './ingresos.service.js';

export async function crear(req, res) {
  res.status(201).json({ ingreso: await service.crear(req.body, req.user) });
}

export async function listar(req, res) {
  res.json(await service.listar(req.validated.query));
}

export async function obtener(req, res) {
  res.json({ ingreso: await service.obtener(req.validated.params.id) });
}
