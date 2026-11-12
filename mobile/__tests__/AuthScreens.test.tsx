import { mockNativeAlerts, pressNativeAlert } from '../test-utils/nativeAlerts';
import { ScreenMessageProvider } from '../src/components/ScreenMessage';
import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  BackHandler,
  StyleSheet,
  TextInput,
} from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError } from '../src/api/errors';
import {
  ARM_LEFT_REST,
  HERO_ARM,
  HERO_ARM_LEFT,
} from '../src/components/AuthHero';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { ChangePasswordScreen } from '../src/screens/auth/ChangePasswordScreen';

const mockAuth = {
  status: 'unauthenticated',
  user: null,
  busy: false,
  login: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
  changePassword: jest.fn(),
};
jest.mock('../src/auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../src/navigation/FrontendNavigator', () => ({
  FrontendNavigator: () => null,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

type Renderer = ReactTestRenderer.ReactTestRenderer;
let app: Renderer | undefined;
let loopStart: jest.Mock;

beforeEach(() => {
  mockNativeAlerts();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  mockAuth.logout.mockReset().mockResolvedValue(undefined);
  mockAuth.login.mockReset().mockResolvedValue(undefined);
  mockAuth.changePassword.mockReset().mockResolvedValue(undefined);
  loopStart = jest.fn();
  const loop = Animated.loop;
  jest.spyOn(Animated, 'loop').mockImplementation((...args) => {
    const animation = loop(...args);
    return { ...animation, start: loopStart, stop: () => undefined };
  });
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
});

afterEach(async () => {
  await act(async () => app?.unmount());
  app = undefined;
  jest.restoreAllMocks();
});

async function render(element: React.ReactElement, reduceMotion = true) {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(reduceMotion);
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>{element}</ScreenMessageProvider>,
    );
  });
  return app!;
}

const text = () => JSON.stringify(app!.toJSON());

// The stack keeps earlier screens mounted; the newest match is on top.
function control(label: string) {
  const matches = app!.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
  expect(matches.length).toBeGreaterThan(0);
  return matches[matches.length - 1];
}

async function press(label: string) {
  if (
    (label === 'Cancelar' || label === 'Confirmar') &&
    !app!.root.findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    ).length
  ) {
    await act(async () => {
      pressNativeAlert(label);
    });
    return;
  }
  await act(async () => control(label).props.onPress());
}

function field(label: string) {
  const matches = app!.root.findAll(
    node => node.type === TextInput && node.props.accessibilityLabel === label,
  );
  expect(matches.length).toBeGreaterThan(0);
  return matches[matches.length - 1];
}

async function type(label: string, value: string) {
  await act(async () => field(label).props.onChangeText(value));
}

describe('welcome', () => {
  test('is the first screen and leads to login', async () => {
    await render(<RootNavigator />);
    expect(text()).toContain('Vamos nos movimentar?');
    expect(text()).toContain('Sou aluno');
    await press('Sou professor');
    expect(text()).toContain('Qual é o seu e-mail?');
    expect(text()).toContain('Passo 1 de 2');
  });

  test('explains the first access and leads to login, without sign up', async () => {
    await render(<RootNavigator />);
    await press('Sou aluno');
    expect(text()).toContain('senha provisória');
    expect(text()).toContain('Esqueceu a senha?');
    expect(app!.root.findAll(node => node.type === TextInput).length).toBe(0);
    await press('Entrar com a senha provisória');
    expect(text()).toContain('Qual é o seu e-mail?');
  });
});

describe('two step login', () => {
  async function openLogin() {
    await render(<RootNavigator />);
    await press('Sou professor');
  }

  test('an invalid e-mail does not advance', async () => {
    await openLogin();
    await type('E-mail', 'maria');
    await press('Continuar');
    expect(text()).toContain('Informe um e-mail válido.');
    expect(text()).toContain('Passo 1 de 2');
    expect(text()).not.toContain('Passo 2 de 2');
  });

  test('going back from the password keeps the e-mail', async () => {
    await openLogin();
    await type('E-mail', 'maria@example.com');
    await press('Continuar');
    expect(text()).toContain('Passo 2 de 2');
    await press('Voltar');
    expect(text()).toContain('Passo 1 de 2');
    expect(field('E-mail').props.value).toBe('maria@example.com');
  });

  test('a field error disappears as soon as the person types', async () => {
    await openLogin();
    await press('Continuar');
    expect(text()).toContain('Informe seu e-mail.');
    await type('E-mail', 'm');
    expect(text()).not.toContain('Informe seu e-mail.');
    expect(field('E-mail').props.accessibilityHint).not.toBe(
      'Informe seu e-mail.',
    );
    await type('E-mail', 'maria@example.com');
    await press('Continuar');
    await type('Senha', 'curta');
    await press('Entrar');
    expect(text()).toContain('A senha deve ter pelo menos 12 caracteres.');
    await type('Senha', 'curta1');
    expect(text()).not.toContain('A senha deve ter pelo menos 12 caracteres.');
  });

  test('the system back on the password step returns to the e-mail', async () => {
    const handlers: Array<Parameters<typeof BackHandler.addEventListener>[1]> =
      [];
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.push(handler);
        return { remove: () => undefined };
      });
    await openLogin();
    await type('E-mail', 'maria@example.com');
    await press('Continuar');
    expect(text()).toContain('Passo 2 de 2');
    expect(handlers.length).toBeGreaterThan(0);
    await act(async () => {
      handlers.forEach(handler =>
        handler({ type: 'hardwareBackPress', timeStamp: 0 }),
      );
    });
    expect(text()).toContain('Passo 1 de 2');
    expect(field('E-mail').props.value).toBe('maria@example.com');
  });

  test('submits the normalized e-mail and the password', async () => {
    await openLogin();
    await type('E-mail', ' Maria@Example.com ');
    await press('Continuar');
    await type('Senha', 'senha-provisoria-1');
    await press('Entrar');
    expect(mockAuth.login).toHaveBeenCalledWith({
      email: 'maria@example.com',
      password: 'senha-provisoria-1',
    });
  });

  test('a short password is rejected before calling the API', async () => {
    await openLogin();
    await type('E-mail', 'maria@example.com');
    await press('Continuar');
    await type('Senha', 'curta');
    await press('Entrar');
    expect(mockAuth.login).not.toHaveBeenCalled();
    expect(text()).toContain('A senha deve ter pelo menos 12 caracteres.');
  });

  test('announces invalid credentials and offline errors', async () => {
    await openLogin();
    await type('E-mail', 'maria@example.com');
    await press('Continuar');
    await type('Senha', 'senha-provisoria-1');
    mockAuth.login.mockRejectedValueOnce(
      new ApiError('session_expired', 'x', 401, 'invalid_credentials'),
    );
    await press('Entrar');
    const invalid = 'E-mail ou senha incorretos. Confira e tente novamente.';
    expect(text()).toContain(invalid);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `Erro. ${invalid}`,
    );
    mockAuth.login.mockRejectedValueOnce(new ApiError('network', 'x'));
    await press('Entrar');
    expect(text()).toContain(
      'Sem conexão com o servidor. Verifique sua internet.',
    );
  });

  test('shows and hides the password', async () => {
    await openLogin();
    await type('E-mail', 'maria@example.com');
    await press('Continuar');
    expect(field('Senha').props.secureTextEntry).toBe(true);
    await press('Mostrar senha');
    expect(field('Senha').props.secureTextEntry).toBe(false);
    await press('Ocultar senha');
    expect(field('Senha').props.secureTextEntry).toBe(true);
  });
});

describe('create password', () => {
  test('sign out requires confirmation even during the password change', async () => {
    await render(<ChangePasswordScreen />);
    await press('Sair e entrar com outra conta');
    expect(mockAuth.logout).not.toHaveBeenCalled();
    await press('Cancelar');
    expect(mockAuth.logout).not.toHaveBeenCalled();
    await press('Sair e entrar com outra conta');
    await press('Confirmar');
    expect(mockAuth.logout).toHaveBeenCalledTimes(1);
  });

  const status = (label: string) =>
    app!.root.findAll(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith(`${label}:`) &&
        node.props.accessible === true,
    )[0].props.accessibilityLabel;

  test('the checklist follows the real password rules', async () => {
    await render(<ChangePasswordScreen />);
    expect(status('Pelo menos 12 caracteres')).toMatch(/pendente$/);
    expect(status('Diferente da senha provisória')).toMatch(/pendente$/);
    expect(status('As duas senhas são iguais')).toMatch(/pendente$/);

    await type('Senha provisória', 'provisoria-123');
    await type('Nova senha', 'provisoria-123');
    expect(status('Pelo menos 12 caracteres')).toMatch(/cumprido$/);
    expect(status('Diferente da senha provisória')).toMatch(/pendente$/);

    await type('Nova senha', 'minha-senha-nova');
    await type('Repita a senha', 'minha-senha-nov');
    expect(status('Diferente da senha provisória')).toMatch(/cumprido$/);
    expect(status('As duas senhas são iguais')).toMatch(/pendente$/);

    await type('Repita a senha', 'minha-senha-nova');
    expect(status('As duas senhas são iguais')).toMatch(/cumprido$/);
    await press('Salvar e começar');
    expect(mockAuth.changePassword).toHaveBeenCalledWith(
      'provisoria-123',
      'minha-senha-nova',
    );
  });

  test('keeps the submit validation and its messages', async () => {
    await render(<ChangePasswordScreen />);
    await type('Senha provisória', 'provisoria-123');
    await type('Nova senha', 'provisoria-123');
    await type('Repita a senha', 'provisoria-123');
    await press('Salvar e começar');
    expect(text()).toContain(
      'A nova senha precisa ser diferente da senha temporária.',
    );
    expect(mockAuth.changePassword).not.toHaveBeenCalled();
  });
});

describe('reduce motion', () => {
  test('the welcome mascot breathes when motion is allowed', async () => {
    await render(<RootNavigator />, false);
    // Mascot idle breathing plus the hero's breathing and stretching loops.
    expect(Animated.loop).toHaveBeenCalledTimes(3);
    expect(loopStart).toHaveBeenCalledTimes(3);
  });

  test('no animation runs when reduce motion is on', async () => {
    await render(<RootNavigator />, true);
    expect(Animated.loop).not.toHaveBeenCalled();
    const arm = app!.root.findByProps({ testID: 'auth-hero-arm' });
    expect(arm).toBeDefined();
  });

  test("the hero arm's shoulder stays hidden inside the body", async () => {
    await render(<RootNavigator />, true);
    const arm = app!.root.findByProps({ testID: 'auth-hero-arm' });
    const style = StyleSheet.flatten(arm.props.style);
    const unit = 112 / 104;
    const shoulderX = (style.left as number) / unit + HERO_ARM.width / 2;
    const shoulderY = ((style.top as number) + (style.height as number)) / unit;
    // Right edge of the body at shoulder height (BODY path in AnimatedMascot:
    // the side runs from x 98 at y 46 downwards and is wider above).
    const bodyRightEdge = 98;
    expect(shoulderY).toBeLessThanOrEqual(46);
    expect(shoulderX + HERO_ARM.width / 2).toBeLessThanOrEqual(bodyRightEdge);
  });

  test('both hero arms are visible, with resting left arm and hidden shoulder', async () => {
    await render(<RootNavigator />, true);
    const leftArm = app!.root.findByProps({ testID: 'auth-hero-arm-left' });
    const rightArm = app!.root.findByProps({ testID: 'auth-hero-arm' });
    expect(leftArm).toBeDefined();
    expect(rightArm).toBeDefined();

    const leftStyle = StyleSheet.flatten(leftArm.props.style);
    const unit = 112 / 104;
    const shoulderX =
      (leftStyle.left as number) / unit + HERO_ARM_LEFT.width / 2;
    const shoulderY =
      ((leftStyle.top as number) + (leftStyle.height as number)) / unit;
    expect(shoulderY).toBeLessThanOrEqual(46);
    // Body left edge at y=44 is ~5.2, shoulder starts at x >= 5.2
    expect(shoulderX - HERO_ARM_LEFT.width / 2).toBeGreaterThanOrEqual(5);
    expect(leftStyle.transform).toEqual([{ rotate: ARM_LEFT_REST }]);
  });

  test('form screens keep the mascot still', async () => {
    await render(<ChangePasswordScreen />, false);
    expect(Animated.loop).not.toHaveBeenCalled();
  });
});
