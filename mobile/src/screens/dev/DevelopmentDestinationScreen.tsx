import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthContext';
import { BrandHeader } from '../../components/BrandHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../theme/theme';

interface Props {
  title: string;
  owner: 'Amanda' | 'Kaylany';
}

export function DevelopmentDestinationScreen({ title, owner }: Props) {
  const { user, logout, busy } = useAuth();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <BrandHeader />
        <View style={styles.card}>
          <Text style={styles.eyebrow}>DESTINO DE INTEGRAÇÃO</Text>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>
            A navegação está pronta. O conteúdo desta tela será desenvolvido por{' '}
            {owner}.
          </Text>
          <Text style={styles.identity}>Acesso atual: {user?.email}</Text>
        </View>
        <PrimaryButton label="Sair da conta" loading={busy} onPress={logout} />
      </View>
    </SafeAreaView>
  );
}

export const PatientHomeScreen = () => (
  <DevelopmentDestinationScreen title="Início" owner="Amanda" />
);
export const PatientWorkoutScreen = () => (
  <DevelopmentDestinationScreen title="Meu treino" owner="Amanda" />
);
export const PatientPreparationScreen = () => (
  <DevelopmentDestinationScreen title="Preparação" owner="Amanda" />
);
export const PatientExerciseScreen = () => (
  <DevelopmentDestinationScreen title="Exercício" owner="Kaylany" />
);
export const PatientCompletionScreen = () => (
  <DevelopmentDestinationScreen title="Conclusão" owner="Amanda" />
);
export const PatientProgressScreen = () => (
  <DevelopmentDestinationScreen title="Progresso" owner="Amanda" />
);
export const PatientListScreen = () => (
  <DevelopmentDestinationScreen title="Pacientes" owner="Amanda" />
);
export const PatientCreateScreen = () => (
  <DevelopmentDestinationScreen title="Cadastro de paciente" owner="Amanda" />
);
export const PatientDetailsScreen = () => (
  <DevelopmentDestinationScreen title="Ficha da paciente" owner="Amanda" />
);
export const WorkoutConfigurationScreen = () => (
  <DevelopmentDestinationScreen title="Configuração de treino" owner="Amanda" />
);
export const PatientMonitoringScreen = () => (
  <DevelopmentDestinationScreen title="Acompanhamento" owner="Amanda" />
);

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 24,
    gap: spacing.md,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  message: { color: colors.textMuted, fontSize: 18, lineHeight: 27 },
  identity: { color: colors.textMuted, fontSize: 14 },
});
