import {
  useCallback,
  useEffect,
  useRef,
  type ComponentRef,
  type PropsWithChildren,
} from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from './AppHeader';
import { Link } from '../ui';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';
import { useFrontendNavigation } from '../navigation/frontendTypes';
import { useDemo } from '../demo/DemoContext';

export function Screen({
  children,
  title,
  subtitle,
  back,
  footer,
  professional = false,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  back?: string;
  footer?: React.ReactNode;
  professional?: boolean;
}>) {
  const navigation = useFrontendNavigation();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useFocusEffect(
    useCallback(() => {
      scroll.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );
  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate(professional ? 'PatientList' : 'PatientHome');
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AppHeader
          title={title}
          backLabel={back}
          onBack={back ? goBack : undefined}
        />
        <ScrollView
          ref={scroll}
          style={s.scrollView}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scroll}
        >
          <View style={s.page}>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            {children}
            {footer && !professional ? (
              <View style={s.scrollFooter}>{footer}</View>
            ) : null}
          </View>
        </ScrollView>
        {professional && footer ? (
          <View style={s.fixedFooter}>{footer}</View>
        ) : null}
        {professional && <ProfessionalTabs />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function ProfessionalTabs() {
  const navigation = useFrontendNavigation();
  const route = navigation.getState().routes[navigation.getState().index].name;
  return (
    <View style={s.tabs}>
      {(['Pacientes', 'Acompanhamento'] as const).map((label, i) => {
        const active =
          i === 1
            ? route === 'PatientMonitoring'
            : route !== 'PatientMonitoring';
        return (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() =>
              navigation.navigate(i === 0 ? 'PatientList' : 'PatientMonitoring')
            }
            style={[s.tab, active && s.activeTab]}
          >
            <Text style={s.tabText}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export function Notice() {
  const { state, dispatch } = useDemo();
  useEffect(() => {
    if (state.message) {
      AccessibilityInfo.announceForAccessibility(state.message);
    }
  }, [state.message]);
  if (!state.message) {
    return null;
  }
  return (
    <View style={s.notice}>
      <Text accessibilityRole="alert" style={s.noticeText}>
        {state.message}
      </Text>
      <Link
        label="Dispensar mensagem"
        onPress={() => dispatch({ type: 'message', value: '' })}
      />
    </View>
  );
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  page: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    paddingHorizontal: layout.pageGutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
    fontFamily: fonts.regular,
  },
  scrollFooter: {
    marginTop: 'auto',
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  fixedFooter: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    paddingHorizontal: layout.pageGutter,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: layout.compactControlHeight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
  },
  activeTab: { backgroundColor: colors.surfaceMuted },
  tabText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  notice: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.successBackground,
  },
  noticeText: { color: colors.success, ...typography.bodySmall },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flex: 1, minWidth: 120 },
});
