import { StyleSheet, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { FormField } from '../src/components/FormField';
import { layout, typography } from '../src/theme/theme';

async function inputStyle(multiline: boolean) {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <FormField label="Campo" value="texto" multiline={multiline} />,
    );
  });
  const style = StyleSheet.flatten(
    renderer!.root.findByType(TextInput).props.style,
  );
  await act(async () => renderer!.unmount());
  return style;
}

describe('FormField', () => {
  test('a single line field has no lineHeight, keeping long text inside', async () => {
    const style = await inputStyle(false);
    expect(style.lineHeight).toBeUndefined();
    expect(style.fontSize).toBe(typography.body.fontSize);
    expect(style.minHeight).toBe(layout.controlHeight);
    expect(style.textAlignVertical).toBe('center');
  });

  test('a multiline field keeps the body line height', async () => {
    const style = await inputStyle(true);
    expect(style.lineHeight).toBe(typography.body.lineHeight);
    expect(style.fontSize).toBe(typography.body.fontSize);
    expect(style.textAlignVertical).toBe('top');
  });
});
