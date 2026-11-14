import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputDinero } from '../src/components/InputDinero.jsx';

function Envoltorio({ inicial = null, onCambio = () => {} }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <InputDinero
        etiqueta="Monto"
        valor={valor}
        onChange={(c) => {
          setValor(c);
          onCambio(c);
        }}
      />
      <output>{String(valor)}</output>
    </>
  );
}

describe('InputDinero', () => {
  it('lo que se escribe en formato argentino se convierte a centavos', async () => {
    const onCambio = vi.fn();
    render(<Envoltorio onCambio={onCambio} />);

    await userEvent.type(screen.getByLabelText('Monto'), '15.000,50');

    expect(onCambio).toHaveBeenLastCalledWith(1500050);
  });

  it('al salir del campo se muestra formateado', async () => {
    render(<Envoltorio />);
    const input = screen.getByLabelText('Monto');
    await userEvent.type(input, '2500');
    await userEvent.tab();
    expect(input).toHaveValue('2.500,00');
  });

  it('muestra el valor inicial y avisa si el texto no es un monto', async () => {
    render(<Envoltorio inicial={990} />);
    const input = screen.getByLabelText('Monto');
    expect(input).toHaveValue('9,90');

    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    expect(screen.getByText(/Monto inválido/)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('vacío → null', async () => {
    render(<Envoltorio inicial={500} />);
    await userEvent.clear(screen.getByLabelText('Monto'));
    expect(screen.getByText('null')).toBeInTheDocument();
  });
});
