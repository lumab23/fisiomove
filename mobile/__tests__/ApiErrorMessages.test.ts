import {
  ApiError,
  apiErrorFromResponse,
  apiErrorMessages,
  friendlyErrorMessage,
} from '../src/api/errors';

/**
 * Every `code` listed in the tables of `docs/contracts/api-conventions.md`
 * (DEC-014). The test reads the document itself, so a new backend code
 * documented there fails here until it gets a pt-BR text.
 */
function documentedCodes(): string[] {
  // Node modules via Jest: the app tsconfig has no Node types.
  const fs = jest.requireActual('fs');
  const path = jest.requireActual('path');
  const testFile: string = expect.getState().testPath ?? '';
  const markdown: string = fs.readFileSync(
    path.join(
      path.dirname(testFile),
      '../../docs/contracts/api-conventions.md',
    ),
    'utf8',
  );
  const codes = new Set<string>();
  for (const line of markdown.split('\n')) {
    const match = /^\|\s*[^|]+\|\s*`([a-z_]+)`\s*\|/.exec(line);
    // The header row reads "| HTTP | `code` | ...".
    if (match && match[1] !== 'code') {
      codes.add(match[1]);
    }
  }
  return [...codes];
}

describe('apiErrorMessages', () => {
  const codes = documentedCodes();

  it('reads the documented code list', () => {
    expect(codes.length).toBeGreaterThan(40);
    expect(codes).toEqual(
      expect.arrayContaining(['validation_error', 'counting_mode_unavailable']),
    );
  });

  it.each(codes)('has a pt-BR text for %s', code => {
    const text = apiErrorMessages[code];
    expect(typeof text).toBe('string');
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('has no text for an undocumented code', () => {
    expect(Object.keys(apiErrorMessages).sort()).toEqual([...codes].sort());
  });
});

describe('friendlyErrorMessage', () => {
  const conflict = apiErrorFromResponse(409, {
    code: 'workout_archived',
    message: 'Workout is archived',
  });

  it('prefers the screen map, then the global map', () => {
    expect(
      friendlyErrorMessage(conflict, { workout_archived: 'Texto da tela.' }),
    ).toBe('Texto da tela.');
    expect(friendlyErrorMessage(conflict)).toBe('Este treino está arquivado.');
  });

  it('falls back to the kind text for an unknown code', () => {
    const unknown = apiErrorFromResponse(409, {
      code: 'brand_new_code',
      message: 'Something in English',
    });
    expect(friendlyErrorMessage(unknown)).toBe(
      'Essas informações foram alteradas. Atualize e tente novamente.',
    );
    expect(friendlyErrorMessage(new ApiError('network', 'offline'))).toBe(
      'Sem conexão com o servidor. Verifique sua internet.',
    );
  });

  it('never shows the English backend message', () => {
    const error = apiErrorFromResponse(403, {
      code: 'account_inactive',
      message: 'Account is inactive',
    });
    expect(friendlyErrorMessage(error)).toBe('Esta conta está desativada.');
  });

  it('uses a generic pt-BR text for failures that are not API errors', () => {
    expect(friendlyErrorMessage(new Error('boom'))).toBe(
      'Não foi possível concluir agora. Tente novamente.',
    );
  });

  it('ignores inherited object keys as codes', () => {
    const error = apiErrorFromResponse(404, {
      code: 'toString',
      message: 'x',
    });
    expect(friendlyErrorMessage(error)).toBe(
      'Não encontramos as informações solicitadas.',
    );
  });
});
