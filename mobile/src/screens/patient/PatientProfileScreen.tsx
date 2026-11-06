import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/ScreenStates';
import {
  useLinkedPhysiotherapist,
  usePatientProfile,
} from '../../integration/usePatientData';
import { useAccount } from '../../navigation/AccountContext';
import { colors, fonts, radii, spacing } from '../../theme/theme';
import { EmptyState, ListGroup, ListRow, SectionTitle, styles } from '../../ui';

export function initialsOf(name: string) {
  return name
    .replace(/^(Dra?\.)\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toLocaleUpperCase('pt-BR'))
    .join('');
}

export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <View
      accessible={false}
      style={[
        profile.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[profile.avatarText, { fontSize: size * 0.36 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

// Shown when the linked professional has no name yet or there is no link.
export function PhysiotherapistEmptyState() {
  return (
    <EmptyState title="Dados do fisioterapeuta">
      As informações do seu fisioterapeuta ainda não aparecem no aplicativo. Se
      precisar falar com ele, use o contato combinado com a clínica.
    </EmptyState>
  );
}

/** Linked physiotherapist: only the name exists (no register, photo, etc.). */
export function LinkedPhysiotherapistCard() {
  const { state, reload } = useLinkedPhysiotherapist();
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label="Carregando dados do fisioterapeuta" />;
  }
  if (state.status === 'failure') {
    return (
      <ErrorState
        title="Não foi possível carregar os dados do fisioterapeuta"
        message={state.message}
        onRetry={reload}
      />
    );
  }
  const name = state.status === 'success' ? state.data.full_name : null;
  if (!name) {
    return <PhysiotherapistEmptyState />;
  }
  return (
    <View
      accessible
      accessibilityLabel={`Seu fisioterapeuta: ${name}`}
      style={[styles.white, profile.identity]}
    >
      <Avatar name={name} />
      <View style={profile.identityText}>
        <Text style={profile.name}>{name}</Text>
        <Text style={profile.muted}>Seu fisioterapeuta</Text>
      </View>
    </View>
  );
}

export function PatientProfileScreen() {
  const { state, reload } = usePatientProfile();
  const account = useAccount();
  let identity: React.ReactNode;
  if (state.status === 'idle' || state.status === 'loading') {
    identity = <LoadingState label="Carregando seu perfil" />;
  } else if (state.status === 'failure') {
    identity = (
      <ErrorState
        title="Não foi possível carregar seu perfil"
        message={state.message}
        onRetry={reload}
      />
    );
  } else {
    identity = (
      <View style={[styles.white, profile.identity]}>
        <Avatar name={state.data.full_name} size={64} />
        <View style={profile.identityText}>
          <Text accessibilityRole="header" style={profile.name}>
            {state.data.full_name}
          </Text>
          {account.email ? (
            <Text style={profile.muted}>{account.email}</Text>
          ) : null}
        </View>
      </View>
    );
  }
  return (
    <Screen tab title="Perfil">
      {identity}

      <View style={profile.section}>
        <SectionTitle>Meu fisioterapeuta</SectionTitle>
        <LinkedPhysiotherapistCard />
      </View>

      {account.signOut ? (
        <View style={profile.section}>
          <SectionTitle>Outros acessos</SectionTitle>
          <ListGroup>
            <ListRow
              icon="logOut"
              title="Sair da conta"
              onPress={account.signOut}
            />
          </ListGroup>
        </View>
      ) : null}
    </Screen>
  );
}

const profile = StyleSheet.create({
  section: { gap: spacing.md },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.xl,
  },
  identityText: { flex: 1, gap: spacing.xs },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  avatar: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontFamily: fonts.bold },
});
