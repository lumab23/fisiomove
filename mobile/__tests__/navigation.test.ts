import type { AuthenticatedUser } from '../src/contracts/auth';
import { selectAuthenticatedFlow } from '../src/navigation/flow';

const user: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'pessoa@example.com',
  role: 'patient',
  is_active: true,
  must_change_password: false,
  created_at: '2026-10-25T00:00:00Z',
  updated_at: '2026-10-25T00:00:00Z',
};

test('bloqueia as rotas de negócio durante a troca obrigatória de senha', () => {
  expect(selectAuthenticatedFlow({ ...user, must_change_password: true })).toBe(
    'change-password',
  );
});

test('separa os fluxos pelo perfil retornado pela API', () => {
  expect(selectAuthenticatedFlow(user)).toBe('patient');
  expect(selectAuthenticatedFlow({ ...user, role: 'physiotherapist' })).toBe(
    'physiotherapist',
  );
});
