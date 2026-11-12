import type { ApiClient } from '../api/ApiClient';
import type {
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
  TokenPair,
} from '../contracts/auth';
import type { AuthenticationSession } from './AuthenticationSession';

export class AuthService {
  constructor(
    private readonly api: ApiClient,
    private readonly session: AuthenticationSession,
  ) {}

  async login(payload: LoginRequest): Promise<AuthenticatedUser> {
    const pair = await this.api.post<TokenPair>('/auth/login', payload, {
      authenticated: false,
      retryAuthentication: false,
    });
    await this.session.save(pair);
    try {
      return await this.me();
    } catch (error) {
      await this.session.clear();
      throw error;
    }
  }

  me(): Promise<AuthenticatedUser> {
    return this.api.get<AuthenticatedUser>('/auth/me');
  }

  async logout(): Promise<void> {
    const refreshToken = await this.currentRefreshToken();
    try {
      if (refreshToken) {
        await this.api.post<void>(
          '/auth/logout',
          { refresh_token: refreshToken },
          { authenticated: false, retryAuthentication: false },
        );
      }
    } finally {
      await this.session.clear();
    }
  }

  async changePassword(
    user: AuthenticatedUser,
    payload: ChangePasswordRequest,
  ): Promise<AuthenticatedUser> {
    await this.api.post<void>('/auth/change-password', payload);
    await this.session.clear();
    return this.login({ email: user.email, password: payload.new_password });
  }

  private async currentRefreshToken(): Promise<string | null> {
    const session = await this.session.load();
    return session?.refresh_token ?? null;
  }
}
