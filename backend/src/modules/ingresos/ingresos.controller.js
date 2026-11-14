import * as service from './ingresos.service.js';

export async function crear(req, res) {
  res.status(201).json({ ingreso: await service.crear(req.body, req.user) });
}

export async function listar(req, res) {
  res.json(await service.listar(req.validated.query));
}
