import * as service from './ventas.service.js';

export async function crear(req, res) {
  res.status(201).json({ venta: await service.crear(req.body, req.user) });
}
