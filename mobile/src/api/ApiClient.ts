import type { AppConfig } from '../config/environment';
import type { AuthenticationSession } from '../auth/AuthenticationSession';
import { ApiError, apiErrorFromResponse } from './errors';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  authenticated?: boolean;
  retryAuthentication?: boolean;
}

export class ApiClient {
  constructor(
    private readonly config: AppConfig,
    private readonly authentication: AuthenticationSession,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get<T>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
  ) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
  ) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T>(
    path: string,
    body: unknown,
    options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
  ) {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const authenticated = options.authenticated ?? true;
    const retryAuthentication = options.retryAuthentication ?? true;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (options.signal?.aborted) {
      controller.abort();
    } else {
      options.signal?.addEventListener('abort', onAbort);
    }
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      if (authenticated && this.authentication.accessToken) {
        headers.Authorization = `Bearer ${this.authentication.accessToken}`;
      }

      const response = await this.fetcher(
        `${this.config.apiOrigin}${this.config.apiPrefix}${path}`,
        {
          method: options.method ?? 'GET',
          headers,
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: controller.signal,
        },
      );

      if (response.status === 401 && authenticated && retryAuthentication) {
        if (controller.signal.aborted) {
          throw new ApiError('unexpected', 'A requisição foi cancelada.');
        }
        await this.authentication.refresh();
        if (controller.signal.aborted) {
          throw new ApiError('unexpected', 'A requisição foi cancelada.');
        }
        return this.request<T>(path, {
          ...options,
          retryAuthentication: false,
        });
      }

      const body = await parseResponse(response);
      if (!response.ok) {
        const error = apiErrorFromResponse(response.status, body);
        if (response.status === 403 && error.code === 'account_inactive') {
          await this.authentication.clear();
        }
        throw error;
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new ApiError(
          options.signal?.aborted ? 'unexpected' : 'timeout',
          options.signal?.aborted
            ? 'A requisição foi cancelada.'
            : 'Tempo de resposta excedido.',
        );
      }
      throw new ApiError('network', 'Não foi possível acessar o servidor.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(
      'unexpected',
      'A resposta da API não é um JSON válido.',
      response.status,
    );
  }
}
