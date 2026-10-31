import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'production' | 'test';

export interface AppConfig {
  apiOrigin: string;
  apiPrefix: '/api/v1';
  environment: AppEnvironment;
  requestTimeoutMs: number;
}

export interface ReleaseEnvironmentVariables {
  FISIOMOVE_API_ORIGIN?: string;
}

export const developmentApiOrigins = {
  android: 'http://10.0.2.2:8000',
  ios: 'http://127.0.0.1:8000',
  default: 'http://127.0.0.1:8000',
} as const;

// Babel injects only these public values from mobile/.env or the build environment.
// React Native does not read the server environment after the bundle is built.
declare const __FISIOMOVE_API_ORIGIN__: string | undefined;
declare const __FISIOMOVE_DEV_API_ORIGIN__: string | undefined;
const developmentApiOrigin =
  typeof __FISIOMOVE_DEV_API_ORIGIN__ === 'string'
    ? __FISIOMOVE_DEV_API_ORIGIN__
    : undefined;
export const productionApiOrigin: string | null =
  typeof __FISIOMOVE_API_ORIGIN__ === 'string'
    ? __FISIOMOVE_API_ORIGIN__
    : null;

export function createAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const environment: AppEnvironment =
    overrides.environment ?? (__DEV__ ? 'development' : 'production');
  const defaultOrigin =
    environment === 'development'
      ? (developmentApiOrigin ?? Platform.select(developmentApiOrigins))
      : productionApiOrigin;
  const apiOrigin = overrides.apiOrigin ?? defaultOrigin;

  if (!apiOrigin) {
    throw new Error('A origem da API precisa ser configurada.');
  }

  const normalizedOrigin = validateApiOrigin(apiOrigin, environment);

  return {
    ...overrides,
    apiOrigin: normalizedOrigin,
    apiPrefix: overrides.apiPrefix ?? '/api/v1',
    environment: overrides.environment ?? environment,
    requestTimeoutMs: overrides.requestTimeoutMs ?? 15_000,
  };
}

export function createReleaseAppConfig(
  variables: ReleaseEnvironmentVariables,
): AppConfig {
  if (!variables.FISIOMOVE_API_ORIGIN) {
    throw new Error('A origem da API precisa ser configurada.');
  }
  return createAppConfig({
    environment: 'production',
    apiOrigin: variables.FISIOMOVE_API_ORIGIN,
  });
}

function validateApiOrigin(
  apiOrigin: string,
  environment: AppEnvironment,
): string {
  let parsed: URL;
  try {
    parsed = new URL(apiOrigin);
  } catch {
    throw new Error('A origem da API precisa ser uma URL válida.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('A origem da API não pode conter credenciais.');
  }
  if (!/^\/*$/.test(parsed.pathname)) {
    throw new Error('A origem da API não pode conter um caminho.');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('A origem da API não pode conter query ou fragmento.');
  }
  if (environment === 'production' && parsed.protocol !== 'https:') {
    throw new Error('A origem da API em produção precisa usar HTTPS.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('A origem da API precisa usar HTTP ou HTTPS.');
  }
  return parsed.origin;
}

export const appConfig = createAppConfig();
