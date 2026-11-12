import { transformFileSync, transformSync } from '@babel/core';
// This test executes in Node; React Native's tsconfig omits Node globals.
declare const __dirname: string;
const { readApiOrigin, apiOriginPlugin } = require('../scripts/api-origin.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('reads the public .env key and gives precedence to the build environment', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fisiomove-origin-'));
  try {
    fs.writeFileSync(
      path.join(directory, '.env'),
      'FISIOMOVE_API_ORIGIN="https://api.example.test"\nAUTH_SECRET_KEY=never-bundle-this\n',
    );
    expect(readApiOrigin(directory, {})).toBe('https://api.example.test');
    expect(
      readApiOrigin(directory, {
        FISIOMOVE_API_ORIGIN: 'https://release.example.test',
      }),
    ).toBe('https://release.example.test');
    const code = transformSync('const origin = __FISIOMOVE_API_ORIGIN__;', {
      configFile: false,
      babelrc: false,
      plugins: [[apiOriginPlugin, { origin: readApiOrigin(directory, {}) }]],
    })!.code!;
    expect(code).toContain('https://api.example.test');
    expect(code).not.toContain('never-bundle-this');
    expect(code).not.toContain('__FISIOMOVE_API_ORIGIN__');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('missing configuration is represented as undefined, with no localhost release fallback', () => {
  const code = transformSync('const origin = __FISIOMOVE_API_ORIGIN__;', {
    configFile: false,
    babelrc: false,
    plugins: [[apiOriginPlugin, {}]],
  })!.code!;
  expect(code).toContain('void 0');
  expect(code).not.toContain('localhost');
});

test.each([
  ['https://release.example.test', null],
  ['http://release.example.test', 'HTTPS'],
  [undefined, 'precisa ser configurada'],
])(
  'evaluates the actual production module with injected origin %s',
  (origin, expectedError) => {
    const { runInNewContext } = require('node:vm');
    const code = transformFileSync(
      path.join(__dirname, '../src/config/environment.ts'),
      {
        configFile: false,
        babelrc: false,
        presets: ['module:@react-native/babel-preset'],
        plugins: [
          [apiOriginPlugin, { origin, devOrigin: 'http://192.168.1.20:8000' }],
        ],
      },
    )!.code!;
    const exported: Record<string, unknown> = {};
    const execute = () =>
      runInNewContext(code, {
        __DEV__: false,
        URL,
        exports: exported,
        module: { exports: exported },
        require: (name: string) =>
          name === 'react-native' ? { Platform: {} } : require(name),
      });
    if (expectedError) {
      expect(execute).toThrow(expectedError);
    } else {
      execute();
      expect(exported.appConfig).toMatchObject({
        apiOrigin: origin,
        environment: 'production',
      });
    }
  },
);

test('reads optional dev origin from .env and prioritizes the build environment', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fisiomove-dev-'));
  const key = 'FISIOMOVE_DEV_API_ORIGIN';
  try {
    expect(readApiOrigin(directory, {}, key)).toBeUndefined();
    fs.writeFileSync(
      path.join(directory, '.env'),
      `${key}=http://192.168.1.20:8000\n`,
    );
    expect(readApiOrigin(directory, {}, key)).toBe('http://192.168.1.20:8000');
    expect(
      readApiOrigin(directory, { [key]: 'http://192.168.1.30:8000' }, key),
    ).toBe('http://192.168.1.30:8000');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test.each([
  [true, 'ios', undefined, 'http://127.0.0.1:8000', null],
  [true, 'android', undefined, 'http://10.0.2.2:8000', null],
  [true, 'ios', 'http://192.168.1.20:8000/', 'http://192.168.1.20:8000', null],
  [
    true,
    'android',
    'http://192.168.1.20:8000',
    'http://192.168.1.20:8000',
    null,
  ],
  [true, 'ios', 'invalid', null, 'URL válida'],
  [true, 'ios', '', null, 'precisa ser configurada'],
  [true, 'ios', 'ftp://192.168.1.20', null, 'HTTP ou HTTPS'],
  [true, 'ios', 'http://user:secret@192.168.1.20', null, 'credenciais'],
  [true, 'ios', 'http://192.168.1.20/api/v1', null, 'caminho'],
  [
    false,
    'ios',
    'http://192.168.1.20:8000',
    'https://release.example.test',
    null,
  ],
])(
  'evaluates dev origin (dev=%s, platform=%s, origin=%s)',
  (development, platform, devOrigin, expectedOrigin, expectedError) => {
    const { runInNewContext } = require('node:vm');
    const code = transformFileSync(
      path.join(__dirname, '../src/config/environment.ts'),
      {
        configFile: false,
        babelrc: false,
        presets: ['module:@react-native/babel-preset'],
        plugins: [
          [
            apiOriginPlugin,
            { origin: 'https://release.example.test', devOrigin },
          ],
        ],
      },
    )!.code!;
    const exported: Record<string, unknown> = {};
    const execute = () =>
      runInNewContext(code, {
        __DEV__: development,
        URL,
        exports: exported,
        module: { exports: exported },
        require: (name: string) =>
          name === 'react-native'
            ? {
                Platform: {
                  select: (origins: Record<string, string>) =>
                    origins[platform],
                },
              }
            : require(name),
      });
    if (expectedError) {
      expect(execute).toThrow(expectedError);
    } else {
      execute();
      expect(exported.appConfig).toMatchObject({ apiOrigin: expectedOrigin });
    }
    expect(code).not.toContain('__FISIOMOVE_DEV_API_ORIGIN__');
  },
);
