import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import { demoExercise } from '../../demo/model';
import { usePatientTabNavigation } from '../../navigation/frontendTypes';
import { colors, fonts, radii, spacing } from '../../theme/theme';
import {
  Badge,
  Button,
  EmptyState,
  Link,
  ListGroup,
  Mascot,
  SectionTitle,
} from '../../ui';
import { SessionRow } from './SessionRow';

export function PatientHomeScreen() {
  const navigation = usePatientTabNavigation();
  const patient = useDemoPatient();
  const { state, dispatch } = useDemo();
  const last = state.sessions.find(session => session.patientId === patient.id);
  const start = () => {
    dispatch({ type: 'start' });
    navigation.navigate('PatientPreparation');
  };
  return (
    <Screen tab>
      <View style={home.greeting}>
        <Text accessibilityRole="header" style={home.hello}>
          Olá, {patient.name.split(' ')[0]}!
        </Text>
        <Mascot kind="home" small />
      </View>
      {patient.published ? (
        <View style={home.hero}>
          <View style={home.heroTop}>
            <Text style={home.eyebrow}>TREINO DE HOJE</Text>
            <Badge tone="inverse" label="Exemplo" />
          </View>
          <Text accessibilityRole="header" style={home.title}>
            {demoExercise.name}
          </Text>
          <Text style={home.meta}>
            {demoExercise.series} séries · {patient.repetitions} repetições ·{' '}
            {demoExercise.side}
          </Text>
          {patient.note !== '' && (
            <View style={home.note}>
              <Text style={home.noteLabel}>Orientação do profissional</Text>
              <Text style={home.noteText}>{patient.note}</Text>
            </View>
          )}
          <Button
            inverse
            icon="play"
            label="Iniciar treino"
            accessibilityHint="Abre a preparação do exercício"
            onPress={start}
          />
        </View>
      ) : (
        <EmptyState title="Nenhum treino publicado">
          Seu fisioterapeuta ainda está preparando o treino.
        </EmptyState>
      )}
      <View style={home.section}>
        <SectionTitle>Última atividade</SectionTitle>
        {last ? (
          <ListGroup>
            <SessionRow session={last} />
          </ListGroup>
        ) : (
          <Text style={home.muted}>Nenhuma sessão realizada ainda.</Text>
        )}
        <Link
          label="Ver histórico e progresso  ›"
          onPress={() =>
            navigation.navigate('PatientExercises', { section: 'progress' })
          }
        />
      </View>
      <View style={home.safety} accessible>
        <Icon name="info" size={20} color={colors.textMuted} />
        <Text style={home.safetyText}>
          Se sentir dor ou desconforto, pare e siga a orientação do seu
          fisioterapeuta.
        </Text>
      </View>
    </Screen>
  );
}

const home = StyleSheet.create({
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  hello: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.onPrimaryMuted,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  title: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  meta: {
    color: colors.onPrimaryMuted,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  note: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noteLabel: {
    color: colors.onPrimaryMuted,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  noteText: {
    color: colors.onPrimary,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  section: { gap: spacing.sm },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  safetyText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
});
