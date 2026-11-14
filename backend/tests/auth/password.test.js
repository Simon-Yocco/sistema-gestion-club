import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/modules/auth/password.js';

describe('hash de contraseñas', () => {
  it('genera un hash bcrypt que no contiene la contraseña', async () => {
    const hash = await hashPassword('secreto123');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash).not.toContain('secreto123');
  });

  it('dos hashes de la misma contraseña son distintos (salt)', async () => {
    expect(await hashPassword('secreto123')).not.toBe(await hashPassword('secreto123'));
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword('secreto123');
    expect(await verifyPassword('secreto123', hash)).toBe(true);
    expect(await verifyPassword('Secreto123', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });
});
