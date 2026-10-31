import {
  createAppConfig,
  createReleaseAppConfig,
} from '../src/config/environment';

test('aceita HTTP local em desenvolvimento e remove barras finais', () => {
  expect(
    createAppConfig({
      environment: 'development',
      apiOrigin: 'http://192.168.1.20:8000///',
    }).apiOrigin,
  ).toBe('http://192.168.1.20:8000');
});

test('exige HTTPS em produção', () => {
  expect(() =>
    createAppConfig({
      environment: 'production',
      apiOrigin: 'http://api.example.test',
    }),
  ).toThrow('HTTPS');
  expect(
    createAppConfig({
      environment: 'production',
      apiOrigin: 'https://api.example.test',
    }).apiOrigin,
  ).toBe('https://api.example.test');
});

test.each([
  'not-a-url',
  'https://user:password@api.example.test',
  'https://api.example.test?token=secret',
  'https://api.example.test#fragment',
])('rejeita origem insegura ou ambígua: %s', apiOrigin => {
  expect(() =>
    createAppConfig({ environment: 'production', apiOrigin }),
  ).toThrow();
});

test('adapta a variável de build sem definir domínio padrão inseguro', () => {
  expect(() => createReleaseAppConfig({})).toThrow(
    'A origem da API precisa ser configurada.',
  );
  expect(
    createReleaseAppConfig({
      FISIOMOVE_API_ORIGIN: 'https://api.example.test',
    }).apiOrigin,
  ).toBe('https://api.example.test');
});

test.each([
  'https://api.example.test/api/v1',
  'https://api.example.test/private',
])('rejeita caminho na origem: %s', apiOrigin => {
  expect(() =>
    createAppConfig({ environment: 'production', apiOrigin }),
  ).toThrow('caminho');
});
