import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHero } from '../../components/AuthHero';
import { BrandLogo } from '../../components/BrandLogo';
import { Icon, type IconName } from '../../components/Icon';
import type { AuthStackParamList } from '../../navigation/types';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../../theme/theme';

export function WelcomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList, 'Welcome'>>();
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <BrandLogo height={32} />
        </View>
        <View style={styles.content}>
          <View style={styles.intro}>
            <View style={styles.mascot}>
              <AuthHero width={112} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              Vamos nos movimentar?
            </Text>
            <Text style={styles.subtitle}>
              Escolha como deseja acessar o aplicativo.
            </Text>
          </View>
          <View style={styles.actions}>
            <AccessCard
              title="Sou aluno"
              description="Quero acompanhar meus exercícios"
              icon="user"
              onPress={() => navigation.navigate('FirstAccess')}
            />
            <AccessCard
              title="Sou professor"
              description="Quero acompanhar meus alunos"
              icon="chart"
              professional
              onPress={() => navigation.navigate('Login')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AccessCard({
  title,
  description,
  icon,
  professional = false,
  onPress,
}: {
  title: string;
  description: string;
  icon: IconName;
  professional?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View
        style={[
          styles.icon,
          professional ? styles.professorIcon : styles.studentIcon,
        ]}
      >
        <Icon
          name={icon}
          size={28}
          color={professional ? colors.brandAccent : colors.primary}
        />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Icon name="chevronRight" size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.pageGutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  brand: { alignItems: 'center', paddingVertical: spacing.md },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    gap: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  intro: { alignItems: 'center', gap: spacing.md },
  mascot: { marginBottom: spacing.md },
  title: {
    ...typography.display,
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: { gap: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 120,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardPressed: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  icon: {
    width: layout.compactControlHeight,
    height: layout.compactControlHeight,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentIcon: { backgroundColor: colors.surfaceMuted },
  professorIcon: { backgroundColor: colors.successBackground },
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: {
    ...typography.title,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  description: {
    ...typography.bodySmall,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
