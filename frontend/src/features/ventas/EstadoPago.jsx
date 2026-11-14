const TEXTOS = { pagada: 'Pagada', parcial: 'Pago parcial', pendiente: 'Fiado' };

/** Etiqueta de color con el estado de la venta (anulada o estado de pago). */
export function EstadoPago({ venta }) {
  if (venta.estado === 'anulada') return <span className="etiqueta etiqueta--gris">Anulada</span>;
  return (
    <span className={`etiqueta etiqueta--${venta.estado_pago}`}>{TEXTOS[venta.estado_pago]}</span>
  );
}
