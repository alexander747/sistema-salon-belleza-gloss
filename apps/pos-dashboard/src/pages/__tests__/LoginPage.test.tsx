import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Rol } from '@pos-final/types';

const { mockPost, mockNavigate } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  default: { post: mockPost },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import LoginPage from '../LoginPage';

/** Respuesta de /auth/login con el rol solicitado. */
function loginResponse(rol: Rol) {
  return {
    data: {
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 1, nombre: 'Usuario', email: 'u@t.com', rol, salonId: 1 },
    },
  };
}

async function submitLogin(rol: Rol) {
  mockPost.mockResolvedValue(loginResponse(rol));
  render(<LoginPage />);
  fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/auth/login', expect.anything()));
}

describe('LoginPage — landing por rol tras login', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockNavigate.mockReset();
    localStorage.clear();
  });

  it('MANICURISTA aterriza en /finanzas', async () => {
    await submitLogin(Rol.MANICURISTA);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/finanzas'));
  });

  it('RECEPCIONISTA aterriza en /finanzas', async () => {
    await submitLogin(Rol.RECEPCIONISTA);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/finanzas'));
  });

  it('DUEÑA aterriza en el dashboard "/"', async () => {
    await submitLogin(Rol.DUEÑA);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
  });
});
