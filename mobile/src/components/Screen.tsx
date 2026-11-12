import {
  useCallback,
  useRef,
  type ComponentRef,
  type PropsWithChildren,
  type RefObject,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BlurView } from '@sbaiahmed1/react-native-blur';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from './AppHeader';
import { colors, fonts, layout, spacing, typography } from '../theme/theme';
import { useFrontendNavigation } from '../navigation/frontendTypes';
import {
  professionalTabFor,
  useOpenProfessionalTab,
  type ProfessionalTab,
} from '../navigation/professionalTabs';
import { Icon } from './Icon';

export { professionalTabFor };

export function Screen({
  children,
  title,
  subtitle,
  back,
  footer,
  professional = false,
  tab = false,
  scrollRef,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  back?: string;
  footer?: React.ReactNode;
  professional?: boolean;
  tab?: boolean;
  /** Lets a screen scroll programmatically (e.g. to content shown on top). */
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
}>) {
  const navigation = useFrontendNavigation();
  const openTab = useOpenProfessionalTab(navigation);
  const ownScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scroll = scrollRef ?? ownScroll;
  useFocusEffect(
    useCallback(() => {
      scroll.current?.scrollTo({ y: 0, animated: false });
    }, [scroll]),
  );
  // Transitions come only from the navigator (see `navigation/transitions`).
  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (professional) {
      const state = navigation.getState();
      const current = state.routes[state.index];
      openTab(professionalTabFor(current.name, current.params));
    } else {
      navigation.navigate('PatientTabs');
    }
  };
  return (
    <SafeAreaView
      style={s.safe}
      edges={professional || tab ? ['top', 'left', 'right'] : undefined}
    >
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.safe}>
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function ProfessionalTabs() {
  const navigation = useFrontendNavigation();
  const openTab = useOpenProfessionalTab(navigation);
  const insets = useSafeAreaInsets();
  const state = navigation.getState();
  const current = state.routes[state.index];
  const activeTab = professionalTabFor(current.name, current.params);
  const tabs: { key: ProfessionalTab; label: string; icon: TabIconName }[] = [
    { key: 'patients', label: 'Pacientes', icon: 'people' },
    { key: 'monitoring', label: 'Acompanhamento', icon: 'chart' },
    { key: 'settings', label: 'Configurações', icon: 'settings' },
  ];
  return (
    <View
      style={[
        s.tabsShell,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      <BlurView
        pointerEvents="none"
        blurType="light"
        blurAmount={20}
        overlayColor="rgba(250, 249, 252, 0.68)"
        style={StyleSheet.absoluteFill}
      />
      <View style={s.tabs}>
        {tabs.map(({ key, label, icon }) => {
          const active = key === activeTab;
          const color = active ? colors.primary : colors.textMuted;
          return (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => openTab(key)}
              style={s.tab}
            >
              <TabIcon name={icon} color={color} />
              <Text style={[s.tabText, { color }, active && s.activeTabText]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type TabIconName = 'people' | 'chart' | 'settings';

function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  if (name === 'settings') {
    return <Icon name="settings" size={22} color={color} />;
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === 'people' ? (
        <>
          <Circle cx="9" cy="8" r="3.25" stroke={color} strokeWidth={1.8} />
          <Path
            d="M3.5 20v-1.1a5.5 5.5 0 0 1 11 0V20M16 5.2a3.2 3.2 0 0 1 0 6.2m1.2 2.2a4.8 4.8 0 0 1 3.3 4.6V20"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <Path
            d="M4 19.5V5m0 14.5h16M7.5 15l4-4 3 2 5-6"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="19.5" cy="7" r="1.25" fill={color} />
        </>
      )}
    </Svg>
  );
}
export function Notice() {
  return null;
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
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabsShell: {
    width: '100%',
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(221, 216, 231, 0.7)',
    backgroundColor: 'rgba(250, 249, 252, 0.72)',
    overflow: 'hidden',
  },
  tabs: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabText: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  activeTabText: { fontFamily: fonts.bold },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flex: 1, minWidth: 120 },
});
