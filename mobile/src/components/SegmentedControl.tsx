import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  compact = false,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  compact?: boolean;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[segmented.track, compact && segmented.compactTrack]}
    >
      {options.map(([option, label]) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              segmented.option,
              compact && segmented.compactOption,
              selected && segmented.selected,
              selected && compact && segmented.compactSelected,
              pressed && !selected && segmented.pressed,
            ]}
          >
            <Text
              style={[
                segmented.label,
                compact && segmented.compactLabel,
                selected && segmented.selectedLabel,
                selected && compact && segmented.compactSelectedLabel,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segmented = StyleSheet.create({
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: 4,
    gap: 4,
  },
  compactTrack: { backgroundColor: 'transparent', padding: 0, gap: 8 },
  option: {
    flexGrow: 1,
    flexBasis: 90,
    minHeight: 48,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compactOption: {
    flexGrow: 0,
    flexBasis: 'auto',
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  selected: {
    backgroundColor: colors.surface,
    shadowColor: '#2A1B4A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  compactSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: { opacity: 0.7 },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  compactLabel: { fontSize: 15 },
  selectedLabel: { color: colors.primary },
  compactSelectedLabel: { color: colors.onPrimary },
});
