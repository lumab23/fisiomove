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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BrandHeader } from './BrandHeader';
import { Link, styles as ui } from '../ui';
import { colors, fonts } from '../theme/theme';
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
  const { height } = useWindowDimensions();
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scroll}
        >
          <View
            style={[
              s.page,
              { minHeight: professional ? undefined : height - 48 },
            ]}
          >
            <BrandHeader />
            {back && (
              <Link
                label={`‹  ${back}`}
                onPress={() =>
                  navigation.canGoBack()
                    ? navigation.goBack()
                    : navigation.navigate(
                        professional ? 'PatientList' : 'PatientHome',
                      )
                }
              />
            )}
            {(title || subtitle) && (
              <View style={s.heading}>
                {title && (
                  <Text accessibilityRole="header" style={ui.title}>
                    {title}
                  </Text>
                )}
                {subtitle && <Text style={ui.body}>{subtitle}</Text>}
              </View>
            )}
            {children}
            {footer && !professional && <View style={s.footer}>{footer}</View>}
          </View>
        </ScrollView>
        {professional && footer && <View style={s.fixedFooter}>{footer}</View>}
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
  scroll: { flexGrow: 1, alignItems: 'center' },
  page: { width: '100%', maxWidth: 560, padding: 24, paddingTop: 10, gap: 24 },
  heading: { gap: 12, marginTop: 4 },
  footer: { marginTop: 'auto', paddingTop: 12, gap: 12 },
  fixedFooter: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    padding: 8,
    backgroundColor: colors.surface,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: 18,
  },
  activeTab: { backgroundColor: colors.surfaceMuted },
  tabText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  notice: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.successBackground,
  },
  noticeText: { color: colors.success, fontSize: 16, lineHeight: 23 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  column: { flex: 1, minWidth: 120 },
});
