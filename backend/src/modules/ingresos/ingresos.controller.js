import * as service from './ingresos.service.js';

export async function crear(req, res) {
  res.status(201).json({ ingreso: await service.crear(req.body, req.user) });
}
