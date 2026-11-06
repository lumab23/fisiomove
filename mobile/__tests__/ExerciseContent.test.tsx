import React from 'react';
import { Image, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiClient } from '../src/api/ApiClient';
import { appDependencies } from '../src/app/dependencies';
import { AuthenticationSession } from '../src/auth/AuthenticationSession';
import {
  ExerciseImageGallery,
  imageAttribution,
} from '../src/components/ExerciseImageGallery';
import type { AppConfig } from '../src/config/environment';
import {
  exerciseImages,
  exerciseSourceText,
  exerciseText,
} from '../src/screens/patient/workoutText';
import {
  buildTranslation,
  stepsFromText,
  textFromSteps,
} from '../src/screens/professional/ExerciseTranslation';
import { memoryStorage } from '../test-utils/helpers';

jest.mock('../src/app/dependencies', () => ({
  appDependencies: {
    api: { imageSource: jest.fn(), refreshAuthentication: jest.fn() },
  },
}));
const api = appDependencies.api as unknown as {
  imageSource: jest.Mock;
  refreshAuthentication: jest.Mock;
};

// Shapes follow docs/contracts/domain-contracts.md; texts are test-only.
const source = {
  source: 'OpenExerciseBase (Test Institute)',
  external_id: 'EX-test-1',
  source_url: 'https://example.com/EX.json',
  license: 'CC BY-NC 4.0',
  license_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'Test attribution.',
};
const localization = {
  language: 'pt-BR',
  name: 'Nome de teste',
  instructions: '1. Primeiro passo de teste.\n2. Segundo passo de teste.',
  translated_by_name: 'Dra. Teste',
  translated_at: '2026-11-06T12:00:00Z',
};
const snapshot = (value: Record<string, unknown>) =>
  ({ exercise_snapshot: value }) as never;

describe('patient text (DEC-011)', () => {
  test('uses the pt-BR text without the English seal when translated', () => {
    const item = snapshot({
      name: 'Original Test',
      instructions: '1. Original step.',
      source,
      localization,
    });
    expect(exerciseText(item)).toEqual({
      name: 'Nome de teste',
      steps: localization.instructions,
      original: false,
    });
    expect(exerciseSourceText(item)).toBe(
      'Adaptado de OpenExerciseBase (CC BY-NC 4.0). Nome e passos traduzidos para o português por Dra. Teste em 06/11/2026; o original em inglês foi preservado.',
    );
  });

  test('falls back to the original, marked as English only for library text', () => {
    const library = snapshot({
      name: 'Original Test',
      instructions: '1. Original step.',
      source,
      localization: null,
    });
    expect(exerciseText(library)).toEqual({
      name: 'Original Test',
      steps: '1. Original step.',
      original: true,
    });
    expect(exerciseSourceText(library)).toBe(
      'Fonte: OpenExerciseBase (CC BY-NC 4.0)',
    );
    // Snapshot published before the fields existed, created in FisioMove.
    expect(exerciseText(snapshot({ name: 'Exercício local' }))).toEqual({
      name: 'Exercício local',
      steps: null,
      original: false,
    });
    // Incomplete localization is ignored instead of mixing languages.
    expect(
      exerciseText(
        snapshot({
          name: 'Original Test',
          source,
          localization: { name: 'X' },
        }),
      ).original,
    ).toBe(true);
  });

  test('reads valid images in position order and ignores the rest', () => {
    expect(
      exerciseImages({
        images: [
          { position: 2, url: '/api/v1/exercises/e/images/2' },
          { position: 'x', url: '/bad' },
          { position: 1, url: '/api/v1/exercises/e/images/1' },
        ],
      }),
    ).toEqual([
      { position: 1, url: '/api/v1/exercises/e/images/1' },
      { position: 2, url: '/api/v1/exercises/e/images/2' },
    ]);
    expect(exerciseImages({ name: 'old snapshot' })).toEqual([]);
  });
});

describe('translation form (DEC-011)', () => {
  test('one step per line, without numbering or empty lines', () => {
    expect(stepsFromText('1. Primeiro\n\n  2) Segundo  \nTerceiro')).toEqual([
      'Primeiro',
      'Segundo',
      'Terceiro',
    ]);
    expect(textFromSteps('1. Primeiro\n2. Segundo')).toBe('Primeiro\nSegundo');
  });

  test('optional: both or neither', () => {
    expect(buildTranslation({ name: ' ', steps: '\n' }, false)).toEqual({
      translation: null,
    });
    expect(buildTranslation({ name: 'Nome', steps: '' }, false)).toEqual({
      errors: {
        steps:
          'Escreva também os passos em português, ou deixe os dois campos vazios.',
      },
    });
    expect(buildTranslation({ name: '', steps: 'Passo' }, false)).toEqual({
      errors: {
        name: 'Escreva também o nome em português, ou deixe os dois campos vazios.',
      },
    });
    expect(buildTranslation({ name: ' Nome ', steps: 'A\nB' }, false)).toEqual({
      translation: { name: 'Nome', instructions: ['A', 'B'] },
    });
  });

  test('required on the edit screen and limited as in the API', () => {
    expect(buildTranslation({ name: '', steps: '' }, true)).toEqual({
      errors: {
        name: 'Escreva o nome em português.',
        steps: 'Escreva pelo menos um passo em português.',
      },
    });
    const tooMany = Array.from({ length: 51 }, (_, i) => `Passo ${i}`);
    expect(
      buildTranslation(
        { name: 'x'.repeat(201), steps: tooMany.join('\n') },
        true,
      ),
    ).toEqual({
      errors: {
        name: 'O nome pode ter no máximo 200 caracteres.',
        steps: 'Use no máximo 50 passos (um por linha).',
      },
    });
    expect(
      buildTranslation({ name: 'Nome', steps: 'x'.repeat(2001) }, true),
    ).toEqual({
      errors: { steps: 'Cada passo pode ter no máximo 2000 caracteres.' },
    });
  });
});

describe('ApiClient.imageSource (DEC-010)', () => {
  const config: AppConfig = {
    apiOrigin: 'http://api.test',
    apiPrefix: '/api/v1',
    environment: 'test',
    requestTimeoutMs: 1_000,
  };

  test('absolute URL on the API origin with the bearer token', async () => {
    const session = new AuthenticationSession(config, memoryStorage());
    await session.save({
      access_token: 'token-1',
      refresh_token: 'refresh-token-with-more-than-thirty-two-characters',
      token_type: 'bearer',
      expires_in: 60,
    });
    const client = new ApiClient(config, session);
    expect(client.imageSource('/api/v1/exercises/e-1/images/1')).toEqual({
      uri: 'http://api.test/api/v1/exercises/e-1/images/1',
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  test.each([
    'https://raw.githubusercontent.com/x.png',
    '//evil.test/api/v1/x',
    '/api/v1//evil.test/x',
    '/api/v1/../x',
    '/other/x',
    '/api/v1/x?token=1',
  ])('refuses %s so the token never leaves the API', path => {
    const client = new ApiClient(
      config,
      new AuthenticationSession(config, memoryStorage()),
    );
    expect(client.imageSource(path)).toBeNull();
  });
});

describe('ExerciseImageGallery', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  const images = [
    { position: 1, url: '/api/v1/exercises/e-1/images/1' },
    { position: 2, url: '/api/v1/exercises/e-1/images/2' },
  ];
  let token = 'old';

  beforeEach(() => {
    token = 'old';
    api.imageSource.mockImplementation((url: string) => ({
      uri: `http://api.test${url}`,
      headers: { Authorization: `Bearer ${token}` },
    }));
    api.refreshAuthentication.mockImplementation(async () => {
      token = 'new';
    });
  });
  afterEach(async () => {
    jest.clearAllMocks();
    await act(async () => tree.unmount());
  });

  async function render(limit?: number) {
    await act(async () => {
      tree = ReactTestRenderer.create(
        <ExerciseImageGallery
          images={images}
          exerciseName="Nome de teste"
          limit={limit}
        />,
      );
    });
  }
  const texts = () =>
    tree.root.findAllByType(Text).map(node => String(node.props.children));

  test('loads through the API with alt text and the attribution', async () => {
    await render();
    const shown = tree.root.findAllByType(Image);
    expect(shown.map(node => node.props.accessibilityLabel)).toEqual([
      'Imagem 1 de 2 do exercício Nome de teste',
      'Imagem 2 de 2 do exercício Nome de teste',
    ]);
    expect(shown[0].props.source).toEqual({
      uri: 'http://api.test/api/v1/exercises/e-1/images/1',
      headers: { Authorization: 'Bearer old' },
    });
    expect(texts()).toContain(imageAttribution);
  });

  test('a limit shows the first image and keeps the total in the alt text', async () => {
    await render(1);
    const shown = tree.root.findAllByType(Image);
    expect(shown).toHaveLength(1);
    expect(shown[0].props.accessibilityLabel).toBe(
      'Imagem 1 de 2 do exercício Nome de teste',
    );
  });

  test('renews the session once after a failure, then gives up with a text', async () => {
    await render(1);
    await act(async () => tree.root.findByType(Image).props.onError());
    expect(api.refreshAuthentication).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType(Image).props.source.headers).toEqual({
      Authorization: 'Bearer new',
    });
    await act(async () => tree.root.findByType(Image).props.onError());
    expect(api.refreshAuthentication).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(texts()).toContain(
      'Não foi possível carregar a imagem 1 de 2 do exercício Nome de teste.',
    );
    expect(texts()).toContain(imageAttribution);
  });

  test('a failed renewal shows the text instead of the image', async () => {
    api.refreshAuthentication.mockRejectedValueOnce(new Error('offline'));
    await render(1);
    await act(async () => tree.root.findByType(Image).props.onError());
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(texts()).toContain(
      'Não foi possível carregar a imagem 1 de 2 do exercício Nome de teste.',
    );
  });

  test('nothing is rendered without images', async () => {
    await act(async () => {
      tree = ReactTestRenderer.create(
        <ExerciseImageGallery images={[]} exerciseName="Nome de teste" />,
      );
    });
    expect(tree.toJSON()).toBeNull();
  });
});
