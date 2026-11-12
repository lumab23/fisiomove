import { useCallback, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { friendlyErrorMessage } from '../../api/errors';
import { ErrorState, LoadingState } from '../../components/ScreenStates';
import { Icon } from '../../components/Icon';
import type {
  NoteVisibility,
  WorkoutItem,
  WorkoutStatus,
} from '../../contracts/domain';
import type { Resource } from '../../integration/usePatientData';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../../theme/theme';

/**
 * Renders loading and failure states for a resource; `children` receives the
 * data on success. `empty` replaces `children` when the API returns nothing.
 */
export function ResourceView<T>({
  resource,
  loadingLabel,
  empty,
  children,
}: {
  resource: Resource<T>;
  loadingLabel: string;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { state, reload } = resource;
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label={loadingLabel} />;
  }
  if (state.status === 'failure') {
    return <ErrorState message={state.message} onRetry={reload} />;
  }
  if (state.status === 'empty' && empty !== undefined) {
    return <>{empty}</>;
  }
  return <>{children(state.data)}</>;
}

/**
 * Reloads when the screen is focused again (after editing in another screen).
 * The first focus is skipped because the resources already load on mount.
 */
export function useReloadOnReturn(...reloads: (() => void)[]) {
  const focused = useRef(false);
  const latest = useRef(reloads);
  latest.current = reloads;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) {
        latest.current.forEach(reload => reload());
      }
      focused.current = true;
    }, []),
  );
}

/** Message for an API error: screen texts first, then the global map. */
export function apiErrorMessage(
  cause: unknown,
  byCode: Readonly<Record<string, string>> = {},
) {
  return friendlyErrorMessage(cause, byCode);
}

export const workoutStatusLabels: Record<WorkoutStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
};

export const visibilityLabels: Record<NoteVisibility, string> = {
  patient_visible: 'Paciente pode ver',
  professional_only: 'Só para o fisioterapeuta',
};

export function restText(item: Pick<WorkoutItem, 'rest_duration_ms'>) {
  const seconds = Math.round(item.rest_duration_ms / 1000);
  return `Descanso de ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
}

/**
 * Single choice without a preselected option: `value` stays `null` until the
 * physiotherapist picks one explicitly.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <View style={choice.group}>
      <Text style={choice.label}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label}>
        <View style={choice.options}>
          {options.map(([option, text]) => {
            const selected = option === value;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={text}
                accessibilityState={{ checked: selected }}
                onPress={() => onChange(option)}
                style={({ pressed }) => [
                  choice.option,
                  selected && choice.selected,
                  pressed && !selected && choice.pressed,
                ]}
              >
                <Text style={[choice.text, selected && choice.selectedText]}>
                  {text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={choice.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Multiple choice without preselected options: `value` starts empty and only
 * changes when the physiotherapist toggles an option.
 */
export function MultiChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  error?: string;
}) {
  return (
    <View style={choice.group}>
      <Text style={choice.label}>{label}</Text>
      <View accessibilityLabel={label} style={choice.options}>
        {options.map(([option, text]) => {
          const selected = value.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="checkbox"
              accessibilityLabel={text}
              accessibilityState={{ checked: selected }}
              onPress={() =>
                onChange(
                  selected
                    ? value.filter(entry => entry !== option)
                    : options
                        .map(([entry]) => entry)
                        .filter(
                          entry => entry === option || value.includes(entry),
                        ),
                )
              }
              style={({ pressed }) => [
                choice.option,
                selected && choice.selected,
                pressed && !selected && choice.pressed,
              ]}
            >
              <View style={choice.checkRow}>
                {selected ? (
                  <Icon name="check" size={20} color={colors.onPrimary} />
                ) : null}
                <Text style={[choice.text, selected && choice.selectedText]}>
                  {text}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={choice.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One on/off option, off until the physiotherapist turns it on. When
 * `disabledReason` is given the option cannot be changed and the reason is
 * shown and read by the screen reader.
 */
export function CheckboxField({
  label,
  checked,
  onChange,
  disabledReason,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabledReason?: string;
  children?: ReactNode;
}) {
  const disabled = Boolean(disabledReason);
  return (
    <View style={choice.group}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityHint={disabledReason}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={({ pressed }) => [
          choice.option,
          checked && choice.selected,
          disabled && choice.disabled,
          pressed && !checked && choice.pressed,
        ]}
      >
        <View style={choice.checkRow}>
          {checked ? (
            <Icon name="check" size={20} color={colors.onPrimary} />
          ) : null}
          <Text
            style={[
              choice.text,
              choice.flexText,
              checked && choice.selectedText,
              disabled && choice.disabledText,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
      {children}
      {disabledReason ? (
        <Text style={choice.hint}>{disabledReason}</Text>
      ) : null}
    </View>
  );
}

const choice = StyleSheet.create({
  group: { gap: spacing.sm },
  label: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  options: { gap: spacing.sm },
  option: {
    minHeight: layout.compactControlHeight,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceMuted },
  text: {
    color: colors.text,
    ...typography.body,
    fontFamily: fonts.regular,
  },
  selectedText: { color: colors.onPrimary, fontFamily: fonts.bold },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flexText: { flexShrink: 1 },
  disabled: { backgroundColor: colors.surfaceMuted },
  disabledText: { color: colors.textMuted },
  hint: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.regular,
  },
  error: {
    color: colors.error,
    ...typography.caption,
    fontFamily: fonts.regular,
  },
});
