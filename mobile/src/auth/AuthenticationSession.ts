import { ApiError, apiErrorFromResponse } from '../api/errors';
import type { AppConfig } from '../config/environment';
import type { StoredSession, TokenPair } from '../contracts/auth';
import type { SecureJsonStorage } from '../storage/secureJsonStorage';

const AUTH_STORAGE_SERVICE = 'br.edu.fisiomove.auth';

type SessionListener = (session: StoredSession | null) => void;

export class AuthenticationSession {
  private currentSession: StoredSession | null = null;
  private refreshPromise: Promise<StoredSession> | null = null;
  private readonly listeners = new Set<SessionListener>();

  constructor(
    private readonly config: AppConfig,
    private readonly storage: SecureJsonStorage,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get accessToken(): string | null {
    return this.currentSession?.access_token ?? null;
  }

  get hasSession(): boolean {
    return this.currentSession !== null;
  }

  async load(): Promise<StoredSession | null> {
    this.currentSession =
      await this.storage.get<StoredSession>(AUTH_STORAGE_SERVICE);
    this.emit();
    return this.currentSession;
  }

  async save(pair: TokenPair): Promise<StoredSession> {
    const session: StoredSession = {
      ...pair,
      access_expires_at: Date.now() + pair.expires_in * 1000,
    };
    await this.storage.set(AUTH_STORAGE_SERVICE, session);
    this.currentSession = session;
    this.emit();
    return session;
  }

  async clear(): Promise<void> {
    this.currentSession = null;
    await this.storage.remove(AUTH_STORAGE_SERVICE);
    this.emit();
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  refresh(): Promise<StoredSession> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<StoredSession> {
    const refreshToken = this.currentSession?.refresh_token;
    if (!refreshToken) {
      throw new ApiError('session_expired', 'Não há sessão para renovar.', 401);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );
    try {
      const response = await this.fetcher(
        `${this.config.apiOrigin}${this.config.apiPrefix}/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
          signal: controller.signal,
        },
      );
      const body = await parseJson(response);
      if (!response.ok) {
        const error = apiErrorFromResponse(response.status, body);
        if (response.status === 401 || response.status === 403) {
          await this.clear();
        }
        throw error;
      }
      return await this.save(body as TokenPair);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new ApiError('timeout', 'A renovação da sessão expirou.');
      }
      throw new ApiError('network', 'Não foi possível renovar a sessão.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private emit(): void {
    this.listeners.forEach(listener => listener(this.currentSession));
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
