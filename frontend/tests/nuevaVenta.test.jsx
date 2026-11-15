import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, crearQueryClient } from '../src/App.jsx';
import { AuthProvider } from '../src/features/auth/AuthContext.jsx';
import { ToastProvider } from '../src/components/Toast.jsx';

const SESION = {
  usuario: { id: 2, nombre: 'Sole', username: 'sole', rol: 'secretaria', activo: true },
  permisos: [
    'ventas.registrar',
    'ventas.consultar',
    'productos.consultar',
    'compradores.gestionar',
  ],
};
const REMERA = {
  id: 1,
  nombre: 'Remera titular',
  precio_venta: '15000.00',
  variantes: [
    { id: 11, color: 'Azul', talle: 'M', stock: 3, activo: true },
    { id: 12, color: 'Azul', talle: 'L', stock: 0, activo: true },
  ],
};
const ANA = {
  id: 7,
  nombre: 'Ana',
  apodo: 'Anita',
  etiqueta: 'Ana ("Anita")',
  telefono: '1155551234',
  puede_fiar: true,
};

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function simularApi() {
  const ventas = [];
  const fetchMock = vi.fn((url, opciones = {}) => {
    if (url.endsWith('/auth/me')) return json(200, SESION);
    if (url.includes('/productos')) return json(200, { productos: [REMERA] });
    if (url.includes('/compradores?')) return json(200, { compradores: [ANA] });
    if (url.endsWith('/ventas') && opciones.method === 'POST') {
      ventas.push(JSON.parse(opciones.body));
      return json(201, { venta: { id: 99 } });
    }
    if (url.endsWith('/ventas/99')) {
      return json(200, {
        venta: {
          id: 99,
          fecha: new Date().toISOString(),
          estado: 'activa',
          estado_pago: 'pagada',
          usuario: { nombre: 'Sole' },
          comprador: null,
          items: [],
          pagos: [],
          cambios: [],
          devoluciones: [],
          total: '15000.00',
          pagado: '15000.00',
          deuda: '0.00',
        },
      });
    }
    return json(404, { error: { code: 'X', message: `no simulado: ${url}` } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return ventas;
}

function renderApp() {
  render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/ventas/nueva']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.unstubAllGlobals());

describe('Nueva venta', () => {
  it('venta simple en efectivo: prenda → todo en efectivo → revisar → confirmar', async () => {
    const ventas = simularApi();
    renderApp();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Buscar prenda'), 'remera');
    // los talles sin stock no aparecen
    expect(await screen.findByRole('button', { name: /Azul M, stock 3/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Azul L/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Azul M, stock 3/ })); // 1
    await user.click(screen.getByRole('button', { name: 'Efectivo' })); // 2
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' })); // 3
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/Total: \$ 15\.000,00/)).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Confirmar venta' })); // 4

    await waitFor(() => expect(ventas).toHaveLength(1));
    expect(ventas[0]).toEqual({
      items: [{ variante_id: 11, cantidad: 1 }],
      pagos: [{ medio: 'efectivo', monto: '15000.00' }],
    });
    expect(await screen.findByRole('heading', { name: /Venta #99/ })).toBeInTheDocument();
  });

  it('el monto del pago sigue al total si se agregan prendas después de elegir el medio', async () => {
    const ventas = simularApi();
    renderApp();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Buscar prenda'), 'remera');
    await user.click(await screen.findByRole('button', { name: /Azul M, stock 3/ }));
    await user.click(screen.getByRole('button', { name: 'Efectivo' }));
    expect(screen.getByLabelText('Monto en efectivo')).toHaveValue('15.000,00');

    await user.click(screen.getByRole('button', { name: /Azul M, stock 3/ }));
    expect(screen.getByLabelText('Monto en efectivo')).toHaveValue('30.000,00');

    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar venta' }),
    );
    await waitFor(() => expect(ventas).toHaveLength(1));
    expect(ventas[0].pagos).toEqual([{ medio: 'efectivo', monto: '30000.00' }]);
  });

  it('pago mixto: al escribir el efectivo, la transferencia se completa con lo que falta', async () => {
    simularApi();
    renderApp();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Buscar prenda'), 'remera');
    await user.click(await screen.findByRole('button', { name: /Azul M, stock 3/ }));
    await user.click(screen.getByRole('button', { name: 'Mixto' }));
    await user.type(screen.getByLabelText('Monto en efectivo'), '4000');
    expect(screen.getByLabelText('Monto en transferencia')).toHaveValue('11.000,00');
  });

  it('no deja fiar sin comprador con teléfono; con comprador elegido sí', async () => {
    const ventas = simularApi();
    renderApp();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Buscar prenda'), 'remera');
    await user.click(await screen.findByRole('button', { name: /Azul M, stock 3/ }));
    await user.click(screen.getByRole('button', { name: /Azul M, stock 3/ })); // 2 unidades

    expect(screen.getByText(/elegí el comprador con su teléfono/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar y confirmar' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Comprador/), 'ani');
    await user.click(await screen.findByRole('button', { name: /Ana \("Anita"\)/ }));
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByText(/Queda fiado: \$ 30\.000,00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    await waitFor(() => expect(ventas).toHaveLength(1));
    expect(ventas[0]).toEqual({
      comprador_id: 7,
      items: [{ variante_id: 11, cantidad: 2 }],
      pagos: [],
    });
  });
});
