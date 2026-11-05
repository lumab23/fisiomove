import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { useAccount } from '../../demo/AccountAccess';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import { demoPhysiotherapist } from '../../demo/model';
import { usePatientTabNavigation } from '../../navigation/frontendTypes';
import { colors, fonts, radii, spacing } from '../../theme/theme';
import { Badge, ListGroup, ListRow, SectionTitle, styles } from '../../ui';

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

export function PatientProfileScreen() {
  const navigation = usePatientTabNavigation();
  const patient = useDemoPatient();
  const { dispatch } = useDemo();
  const account = useAccount();
  return (
    <Screen tab title="Perfil">
      <View style={[styles.white, profile.identity]}>
        <Avatar name={patient.name} size={64} />
        <View style={profile.identityText}>
          <Text accessibilityRole="header" style={profile.name}>
            {patient.name}
          </Text>
          <Text style={profile.muted}>
            {account.email ?? 'Conta de demonstração'}
          </Text>
        </View>
      </View>

      <View style={profile.section}>
        <SectionTitle>Meu fisioterapeuta</SectionTitle>
        <View style={[styles.white, profile.contact]}>
          <View style={profile.contactHeader}>
            <Avatar name={demoPhysiotherapist.name} />
            <View style={profile.identityText}>
              <Text style={profile.name}>{demoPhysiotherapist.name}</Text>
              <Text style={profile.muted}>{demoPhysiotherapist.specialty}</Text>
              <Badge label="Dados de exemplo" />
            </View>
          </View>
          <View style={profile.actions}>
            <ContactAction
              icon="message"
              label="Conversar"
              onPress={() =>
                Alert.alert(
                  'Conversa ainda indisponível',
                  'O contato direto será liberado quando houver um canal autorizado pelo profissional. Por enquanto, use o contato combinado com a clínica.',
                )
              }
            />
            <ContactAction
              icon="info"
              label="Informações"
              onPress={() => navigation.navigate('PhysiotherapistInfo')}
            />
          </View>
        </View>
      </View>

      <View style={profile.section}>
        <SectionTitle>Outros acessos</SectionTitle>
        <ListGroup>
          {account.professionalDemo && (
            <ListRow
              icon="briefcase"
              title="Área profissional (demo)"
              onPress={() => {
                dispatch({ type: 'message', value: '' });
                navigation.navigate('PatientList');
              }}
            />
          )}
          {account.action && (
            <ListRow
              icon={account.email ? 'logOut' : 'logIn'}
              title={account.email ? account.label : 'Entrar com minha conta'}
              onPress={account.action}
            />
          )}
        </ListGroup>
      </View>
    </Screen>
  );
}

function ContactAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [profile.action, pressed && profile.pressed]}
    >
      <Icon name={icon} size={22} color={colors.primary} />
      <Text style={profile.actionText}>{label}</Text>
    </Pressable>
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
  contact: { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.lg },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  actionText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  pressed: { opacity: 0.7 },
});
