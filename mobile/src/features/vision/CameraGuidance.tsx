import type { PropsWithChildren } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { colors, fonts, radii, spacing } from '../../theme/theme';
import { Button } from '../../ui';

export function CameraMessage({
  icon,
  title,
  description,
  children,
}: PropsWithChildren<{
  icon: IconName;
  title: string;
  description: string;
}>) {
  return (
    <View style={guidance.card}>
      <View style={guidance.icon}>
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <Text accessibilityRole="header" style={guidance.title}>
        {title}
      </Text>
      <Text style={guidance.description}>{description}</Text>
      {children ? <View style={guidance.actions}>{children}</View> : null}
    </View>
  );
}

const steps =
  Platform.OS === 'ios'
    ? [
        'Toque em “Abrir Ajustes do celular”.',
        'Toque em “Câmera” e ligue a chave.',
        'Volte para o FisioMove.',
      ]
    : [
        'Toque em “Abrir Ajustes do celular”.',
        'Toque em “Permissões” e depois em “Câmera”.',
        'Escolha “Permitir durante o uso do app”.',
        'Volte para o FisioMove.',
      ];

export function CameraSettingsSteps() {
  return (
    <View style={guidance.steps}>
      {steps.map((step, index) => (
        <View key={step} style={guidance.step}>
          <Text style={guidance.number}>{index + 1}</Text>
          <Text style={guidance.stepText}>{step}</Text>
        </View>
      ))}
      <Button
        icon="settings"
        label="Abrir Ajustes do celular"
        onPress={() => {
          Linking.openSettings().catch(() => undefined);
        }}
      />
      <Text style={guidance.note}>
        Quando você voltar, o FisioMove percebe a mudança sozinho.
      </Text>
    </View>
  );
}

const guidance = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  actions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm },
  steps: { alignSelf: 'stretch', gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    minWidth: 22,
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});
