import type { SecureJsonStorage } from '../src/storage/secureJsonStorage';

export function memoryStorage(): SecureJsonStorage & {
  values: Map<string, unknown>;
} {
  const values = new Map<string, unknown>();
  return {
    values,
    async get<T>(service: string) {
      return (values.get(service) as T | undefined) ?? null;
    },
    async set<T>(service: string, value: T) {
      values.set(service, JSON.parse(JSON.stringify(value)) as T);
    },
    async remove(service: string) {
      values.delete(service);
    },
  };
}

export function response(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest
      .fn()
      .mockResolvedValue(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}
