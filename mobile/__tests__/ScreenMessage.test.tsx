import {
  mockNativeAlerts,
  pressNativeAlert,
  lastNativeAlert,
} from '../test-utils/nativeAlerts';
import React from 'react';
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  ScreenMessageProvider,
  useScreenMessage,
  type ScreenMessageTone,
} from '../src/components/ScreenMessage';
import { useSignOutConfirmation } from '../src/components/SignOutConfirmation';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../src/accessibility/useReduceMotion', () => ({
  useReduceMotion: () => true,
}));

let app: ReactTestRenderer.ReactTestRenderer;
let feedback: ReturnType<typeof useScreenMessage>;
const logout = jest.fn();
function Harness() {
  feedback = useScreenMessage();
  const { requestSignOut } = useSignOutConfirmation(logout);
  return (
    <>
      <Pressable accessibilityLabel="Sair da conta" onPress={requestSignOut} />
    </>
  );
}
beforeEach(() => {
  mockNativeAlerts();
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  logout.mockReset().mockResolvedValue(undefined);
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
});
afterEach(async () => {
  await act(async () => app?.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
async function render() {
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>
        <Harness />
      </ScreenMessageProvider>,
    );
  });
}
async function show(text: string, tone: ScreenMessageTone = 'success') {
  await act(async () => feedback.show(text, tone));
}
async function press(label: string) {
  if (
    (label === 'Cancelar' || label === 'Confirmar') &&
    !app.root.findAll(
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
  await act(async () => {
    app.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}

const alerts = () =>
  app.root
    .findAllByType(Text)
    .filter(node => node.props.accessibilityRole === 'alert');

test.each<ScreenMessageTone>(['success', 'error', 'warning', 'info'])(
  'renders and announces %s feedback',
  async tone => {
    await render();
    await show('Mensagem de teste.', tone);
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0].props.children).toBe('Mensagem de teste.');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalled();
  },
);
test('auto-dismisses success, while errors allow more reading time', async () => {
  await render();
  await show('Salvo.');
  await act(async () => {
    jest.advanceTimersByTime(4501);
  });
  expect(alerts()).toHaveLength(0);
  await show('Falhou.', 'error');
  await act(async () => {
    jest.advanceTimersByTime(4501);
  });
  expect(alerts()).toHaveLength(1);
  await act(async () => {
    jest.advanceTimersByTime(3500);
  });
  expect(alerts()).toHaveLength(0);
});
test('replaces an earlier toast and resets the timeout even for repeated text', async () => {
  await render();
  await show('Primeira.');
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  await show('Segunda.');
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  await show('Segunda.');
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(alerts()).toHaveLength(1);
  expect(alerts()[0].props.children).toBe('Segunda.');
  await press('Fechar mensagem');
  expect(alerts()).toHaveLength(0);
});
test('screen reader users can read without an automatic timeout', async () => {
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
  await render();
  await show('Leia com calma.', 'error');
  await act(async () => {
    jest.advanceTimersByTime(60000);
  });
  expect(alerts()).toHaveLength(1);
  await press('Fechar mensagem');
  expect(alerts()).toHaveLength(0);
});
test('cancel and system back preserve the session; confirm logs out once', async () => {
  await render();
  await press('Sair da conta');
  expect(lastNativeAlert()[0]).toBe('Sair da conta?');
  expect(
    lastNativeAlert()[2]?.map(button => [button.text, button.style]),
  ).toEqual([
    ['Cancelar', 'cancel'],
    ['Confirmar', 'destructive'],
  ]);
  expect(logout).not.toHaveBeenCalled();
  await press('Cancelar');

  await press('Sair da conta');
  await act(async () => lastNativeAlert()[3]?.onDismiss?.());

  expect(logout).not.toHaveBeenCalled();
  await press('Sair da conta');
  await press('Confirmar');
  expect(logout).toHaveBeenCalledTimes(1);

  expect(alerts()[0].props.children).toBe('Você saiu da conta.');
});
test('failed logout shows an error rather than success', async () => {
  logout.mockRejectedValue(new Error('offline'));
  await render();
  await press('Sair da conta');
  await press('Confirmar');
  expect(alerts()[0].props.children).toContain('Não foi possível confirmar');
  expect(JSON.stringify(app.toJSON())).not.toContain('Você saiu da conta.');
});
test('blocks repeated logout requests while the first request is pending', async () => {
  let resolve!: () => void;
  logout.mockReturnValue(
    new Promise<void>(done => {
      resolve = done;
    }),
  );
  await render();
  await press('Sair da conta');
  await press('Confirmar');
  const previous = lastNativeAlert();
  await press('Sair da conta');
  expect(lastNativeAlert()).toBe(previous);
  expect(logout).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
});

test('toast renders in an overlay with absolute positioning, pointerEvents="box-none", and respects safe area', async () => {
  await render();
  await show('Mensagem overlay.');

  const toastCard = app.root.findByProps({ testID: 'feedback-toast' });
  expect(toastCard).toBeDefined();

  const views = app.root.findAllByType(View);
  const overlayView = views.find(
    v =>
      v.props.pointerEvents === 'box-none' &&
      StyleSheet.flatten(v.props.style)?.position === 'absolute' &&
      StyleSheet.flatten(v.props.style)?.top === 0,
  );
  expect(overlayView).toBeDefined();

  const slotView = views.find(
    v =>
      v.props.pointerEvents === 'box-none' &&
      StyleSheet.flatten(v.props.style)?.position === 'absolute' &&
      StyleSheet.flatten(v.props.style)?.bottom === 0 &&
      StyleSheet.flatten(v.props.style)?.paddingBottom !== undefined,
  );
  expect(slotView).toBeDefined();

  // Does not have opaque background on slot
  expect(
    StyleSheet.flatten(slotView!.props.style).backgroundColor,
  ).toBeUndefined();
});
