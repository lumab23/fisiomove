import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Icon, type IconName } from '../../components/Icon';
import { ErrorState, LoadingState } from '../../components/ScreenStates';
import { usePatientProfile } from '../../integration/usePatientData';
import { useAccount } from '../../navigation/AccountContext';
import { colors, fonts, spacing, typography } from '../../theme/theme';
import { ListGroup, SectionTitle, styles as ui } from '../../ui';

/** Patient's own information, with the same layout used in professional settings. */
export function PatientSelfProfileScreen() {
  const { state, reload } = usePatientProfile();
  const { email } = useAccount();

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <Screen back="Configurações" title="Meu perfil">
        <LoadingState label="Carregando seu perfil" />
      </Screen>
    );
  }
  if (state.status === 'failure') {
    return (
      <Screen back="Configurações" title="Meu perfil">
        <ErrorState
          title="Não foi possível carregar seu perfil"
          message={state.message}
          onRetry={reload}
        />
      </Screen>
    );
  }

  return (
    <Screen back="Configurações" title="Meu perfil">
      <View style={s.section}>
        <SectionTitle>Informações pessoais</SectionTitle>
        <ListGroup>
          <InfoRow icon="user" label="Nome" value={state.data.full_name} />
          {email ? <InfoRow icon="mail" label="E-mail" value={email} /> : null}
        </ListGroup>
      </View>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={s.row}>
      <View style={ui.rowIcon}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View accessible accessibilityLabel={`${label}: ${value}`} style={s.rowText}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: spacing.sm },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  label: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.regular,
  },
  value: {
    color: colors.text,
    ...typography.body,
    fontFamily: fonts.bold,
  },
});
