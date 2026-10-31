import { Image, StyleSheet, Text, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { colors, fonts } from '../theme/theme';
import { styles as ui } from '../ui';
export function CameraPreview({
  children,
  compact = false,
}: PropsWithChildren<{ compact?: boolean }>) {
  return (
    <View style={preview.panel}>
      <Text style={preview.label}>PRÉVIA SIMULADA DA CÂMERA</Text>
      <Image
        source={require('../assets/person.png')}
        resizeMode="contain"
        style={compact ? preview.compactPerson : ui.person}
        accessible={false}
      />
      {children}
    </View>
  );
}
export const preview = StyleSheet.create({
  panel: {
    padding: 16,
    gap: 16,
    backgroundColor: '#F6F1FC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  compactPerson: { width: 144, height: 174, alignSelf: 'center' },
});
