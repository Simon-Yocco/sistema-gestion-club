import * as service from './cambios.service.js';

const id = (req) => req.validated.params.id;

export async function previsualizar(req, res) {
  res.json(await service.previsualizar(id(req), req.body));
}

export async function cambiar(req, res) {
  res.status(201).json(await service.cambiar(id(req), req.body, req.user));
}

export async function cambiarSinVenta(req, res) {
  res.status(201).json(await service.cambiarSinVenta(req.body, req.user));
}
