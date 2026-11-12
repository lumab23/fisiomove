import { Alert } from 'react-native';

export function mockNativeAlerts() {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
}
export function lastNativeAlert() {
  const calls = jest.mocked(Alert.alert).mock.calls;
  const call = calls[calls.length - 1];
  if (!call) throw new Error('No native alert was opened');
  return call;
}
export function pressNativeAlert(label: string) {
  const button = lastNativeAlert()[2]?.find(item => item.text === label);
  if (!button) throw new Error(`Missing native alert action: ${label}`);
  return button.onPress?.();
}
