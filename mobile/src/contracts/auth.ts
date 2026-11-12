import type { ISODateTime, UUID } from './common';

export type UserRole = 'patient' | 'physiotherapist';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface StoredSession extends TokenPair {
  access_expires_at: number;
}

export interface AuthenticatedUser {
  id: UUID;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}
