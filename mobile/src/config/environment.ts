import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'production' | 'test';

export interface AppConfig {
  apiOrigin: string;
  apiPrefix: '/api/v1';
  environment: AppEnvironment;
  requestTimeoutMs: number;
}

export const developmentApiOrigins = {
  android: 'http://10.0.2.2:8000',
  ios: 'http://127.0.0.1:8000',
  default: 'http://127.0.0.1:8000',
} as const;

// Configure o domínio HTTPS antes de gerar uma versão de produção.
export const productionApiOrigin: string | null = null;

export function createAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const environment: AppEnvironment = __DEV__ ? 'development' : 'production';
  const defaultOrigin = __DEV__
    ? Platform.select(developmentApiOrigins)
    : productionApiOrigin;
  const apiOrigin = overrides.apiOrigin ?? defaultOrigin;

  if (!apiOrigin) {
    throw new Error('A origem da API precisa ser configurada.');
  }

  return {
    ...overrides,
    apiOrigin: apiOrigin.replace(/\/$/, ''),
    apiPrefix: overrides.apiPrefix ?? '/api/v1',
    environment: overrides.environment ?? environment,
    requestTimeoutMs: overrides.requestTimeoutMs ?? 15_000,
  };
}

export const appConfig = createAppConfig();
