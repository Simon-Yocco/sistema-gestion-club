import * as service from './devoluciones.service.js';

const id = (req) => req.validated.params.id;

export async function previsualizarDevolucion(req, res) {
  res.json(await service.previsualizarDevolucion(id(req), req.body));
}

export async function devolver(req, res) {
  res.status(201).json(await service.devolver(id(req), req.body, req.user));
}

export async function previsualizarAnulacion(req, res) {
  res.json(await service.previsualizarAnulacion(id(req)));
}

export async function anular(req, res) {
  res.status(201).json(await service.anular(id(req), req.body, req.user));
}
