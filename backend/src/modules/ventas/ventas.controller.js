import * as service from './ventas.service.js';

export async function crear(req, res) {
  res.status(201).json({ venta: await service.crear(req.body, req.user) });
}

export async function listar(req, res) {
  res.json(await service.listar(req.validated.query));
}
