import { useRef, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';
import { Icon } from './Icon';

/** Scrollable selection sheet; confirmation dialogs use native alerts instead. */
export function BottomSheet({
  visible,
  title,
  children,
  footer,
  onClose,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const heading = useRef<ComponentRef<typeof Text>>(null);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      onShow={() => {
        const node = findNodeHandle(heading.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }}
    >
      {visible ? (
        <View style={[styles.overlay, { paddingTop: insets.top + spacing.lg }]}>
          <Pressable
            accessible={false}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <View style={styles.header}>
              <Text
                ref={heading}
                accessibilityRole="header"
                style={styles.title}
              >
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar filtros"
                onPress={onClose}
                style={styles.close}
              >
                <Icon name="close" color={colors.primary} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              bounces={false}
            >
              {children}
            </ScrollView>
            <View style={styles.footer}>{footer}</View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.cameraOverlay,
  },
  sheet: {
    backgroundColor: colors.background,
    maxHeight: '90%',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
    fontFamily: fonts.bold,
    color: colors.text,
    flex: 1,
  },
  close: {
    minWidth: layout.compactControlHeight,
    minHeight: layout.compactControlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexShrink: 1, flexGrow: 0 },
  body: { padding: spacing.xl },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
