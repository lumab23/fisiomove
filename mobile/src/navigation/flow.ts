import type { AuthenticatedUser } from '../contracts/auth';

export type AuthenticatedFlow =
  'change-password' | 'patient' | 'physiotherapist';

export function selectAuthenticatedFlow(
  user: AuthenticatedUser,
): AuthenticatedFlow {
  if (user.must_change_password) {
    return 'change-password';
  }
  return user.role;
}
