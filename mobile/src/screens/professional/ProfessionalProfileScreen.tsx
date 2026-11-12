import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { Icon, type IconName } from '../../components/Icon';
import { InlineError } from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { PhysiotherapistProfile } from '../../contracts/domain';
import { useOwnPhysiotherapistProfile } from '../../integration/useProfessionalData';
import { useAccount } from '../../navigation/AccountContext';
import { fonts, layout, spacing, typography } from '../../theme/theme';
import {
  Button,
  colors,
  ListGroup,
  SectionTitle,
  styles as ui,
} from '../../ui';
import { apiErrorMessage, ResourceView } from './shared';

/** Limits of `PhysiotherapistProfileUpdate.full_name` (API contract). */
const nameLength = { min: 2, max: 200 } as const;

export function validateProfessionalName(value: string): string | null {
  const name = value.trim();
  if (name.length < nameLength.min) {
    return 'Informe o nome com pelo menos 2 letras.';
  }
  if (name.length > nameLength.max) {
    return 'O nome pode ter no máximo 200 caracteres.';
  }
  return null;
}

/** Own display name: the only field of the physiotherapist profile (Q-P5). */
export function ProfessionalProfileScreen() {
  const profile = useOwnPhysiotherapistProfile();
  return profile.state.status === 'success' ? (
    <ProfileDetails profile={profile.state.data} />
  ) : (
    <Screen professional back="Configurações" title="Meu perfil">
      <ResourceView resource={profile} loadingLabel="Carregando seu perfil">
        {() => null}
      </ResourceView>
    </Screen>
  );
}

/**
 * Read-only by default: the name only turns into a field after the pencil is
 * pressed, and goes back to the view mode once saved or cancelled.
 */
function ProfileDetails({ profile }: { profile: PhysiotherapistProfile }) {
  const { show } = useScreenMessage();
  const { email } = useAccount();
  const [savedName, setSavedName] = useState(profile.full_name ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(savedName);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(savedName);
    setError(undefined);
    setFailure('');
    setEditing(true);
  };
  const cancel = () => {
    if (saving) {
      return;
    }
    setDraft(savedName);
    setError(undefined);
    setFailure('');
    setEditing(false);
  };
  const save = async () => {
    if (saving) {
      return;
    }
    const invalid = validateProfessionalName(draft);
    setError(invalid ?? undefined);
    setFailure('');
    if (invalid) {
      return;
    }
    const name = draft.trim();
    setSaving(true);
    try {
      await appDependencies.profile.updatePhysiotherapistProfile({
        full_name: name,
      });
      setSavedName(name);
      setEditing(false);
      show('Nome salvo.');
    } catch (cause) {
      setFailure(apiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen professional back="Configurações" title="Meu perfil">
      {failure ? <InlineError message={failure} /> : null}
      <View style={s.section}>
        <SectionTitle>Informações pessoais</SectionTitle>
        <ListGroup>
          {editing ? (
            <View style={s.editing}>
              <FormField
                label="Nome"
                value={draft}
                onChangeText={value => {
                  setDraft(value);
                  setError(undefined);
                }}
                autoFocus
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="done"
                onSubmitEditing={save}
                editable={!saving}
                error={error}
              />
              <View style={s.actions}>
                <View style={s.action}>
                  <Button
                    compact
                    secondary
                    label="Cancelar"
                    disabled={saving}
                    onPress={cancel}
                  />
                </View>
                <View style={s.action}>
                  <Button
                    compact
                    label={saving ? 'Salvando…' : 'Salvar'}
                    disabled={saving}
                    onPress={save}
                  />
                </View>
              </View>
            </View>
          ) : (
            <InfoRow
              icon="user"
              label="Nome"
              value={savedName}
              emptyValue="Não informado"
              action={{ label: 'Editar nome', onPress: startEditing }}
            />
          )}
          {email ? <InfoRow icon="mail" label="E-mail" value={email} /> : null}
        </ListGroup>
        <Text style={s.footnote}>
          Seus pacientes veem este nome no aplicativo.
        </Text>
      </View>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
  emptyValue,
  action,
}: {
  icon: IconName;
  label: string;
  value: string;
  emptyValue?: string;
  action?: { label: string; onPress: () => void };
}) {
  const shown = value || emptyValue || '';
  return (
    <View style={s.row}>
      <View style={ui.rowIcon}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View
        accessible
        accessibilityLabel={`${label}: ${shown}`}
        style={s.rowText}
      >
        <Text style={s.label}>{label}</Text>
        <Text style={[s.value, !value && s.emptyValue]}>{shown}</Text>
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
        >
          <Icon name="edit" size={20} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: spacing.sm },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  label: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.regular,
  },
  value: {
    color: colors.text,
    ...typography.body,
    fontFamily: fonts.bold,
  },
  emptyValue: { color: colors.textMuted, fontFamily: fonts.regular },
  iconButton: {
    alignItems: 'center',
    borderRadius: layout.compactControlHeight / 2,
    height: layout.compactControlHeight,
    justifyContent: 'center',
    width: layout.compactControlHeight,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  editing: { gap: spacing.md, padding: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  footnote: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.regular,
    paddingHorizontal: spacing.xs,
  },
});
