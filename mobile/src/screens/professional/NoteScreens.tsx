import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { InlineError } from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { UUID } from '../../contracts/common';
import type { Note, NoteVisibility } from '../../contracts/domain';
import { useResource } from '../../integration/usePatientData';
import { maxPageSize } from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { colors, fonts, layout, radii, spacing, typography } from '../../theme/theme';
import { Button, SectionTitle } from '../../ui';
import {
  apiErrorMessage,
  ChoiceGroup,
  ResourceView,
  visibilityLabels,
} from './shared';

const never = () => false;
const visibilityOptions = (
  ['patient_visible', 'professional_only'] as const
).map(value => [value, visibilityLabels[value]] as const);

const noteEmojis = ['💪', '👏', '👍', '🙂', '🤝', '⭐', '🏃', '🧘', '🦵', '❤️'] as const;

/** Writes or edits a note; the visibility is always an explicit choice. */
export function NoteEditorScreen() {
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'NoteEditor'>>();
  return params.noteId ? (
    <ExistingNote patientId={params.patientId} noteId={params.noteId} />
  ) : (
    <NoteForm patientId={params.patientId} note={null} />
  );
}

function ExistingNote({
  patientId,
  noteId,
}: {
  patientId: UUID;
  noteId: UUID;
}) {
  // There is no single-note endpoint: the note comes from the patient's list.
  const load = useCallback(
    () =>
      appDependencies.notes
        .list(patientId, { page_size: maxPageSize })
        .then(page => page.items.find(note => note.id === noteId) ?? null),
    [patientId, noteId],
  );
  const note = useResource<Note | null>(load, never);
  if (note.state.status === 'success' && note.state.data) {
    return <NoteForm patientId={patientId} note={note.state.data} />;
  }
  return (
    <Screen professional back="Paciente" title="Editar observação">
      {note.state.status === 'success' ? (
        <InlineError message="Não encontramos esta observação. Volte e atualize a ficha do paciente." />
      ) : (
        <ResourceView resource={note} loadingLabel="Carregando observação">
          {() => null}
        </ResourceView>
      )}
    </Screen>
  );
}

function NoteForm({ patientId, note }: { patientId: UUID; note: Note | null }) {
  const navigation = useFrontendNavigation();
  const { show } = useScreenMessage();
  const [content, setContent] = useState(note?.content ?? '');
  const [visibility, setVisibility] = useState<NoteVisibility | null>(
    note?.visibility ?? null,
  );
  const [emoji, setEmoji] = useState<string | null>(note?.emoji ?? null);
  const [errors, setErrors] = useState<{
    content?: string;
    visibility?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) {
      return;
    }
    const next: typeof errors = {};
    if (!content.trim()) {
      next.content = 'Escreva a observação antes de salvar.';
    }
    if (!visibility) {
      next.visibility = 'Escolha quem pode ver a observação.';
    }
    setErrors(next);
    if (next.content || next.visibility || !visibility) {
      return;
    }
    const payload = { content: content.trim(), visibility, emoji };
    setSaving(true);
    try {
      if (note) {
        await appDependencies.notes.update(note.id, payload);
      } else {
        await appDependencies.notes.create(patientId, payload);
      }
      show('Observação salva.', 'success');
      navigation.goBack();
    } catch (cause) {
      show(apiErrorMessage(cause), 'error');
      setSaving(false);
    }
  };
  return (
    <Screen
      professional
      back="Paciente"
      title={note ? 'Editar observação' : 'Escrever observação'}
      footer={
        <Button
          label={saving ? 'Salvando…' : 'Salvar observação'}
          disabled={saving}
          onPress={save}
        />
      }
    >
      <FormField
        label="Observação"
        value={content}
        onChangeText={value => {
          setContent(value);
          setErrors(current => ({ ...current, content: undefined }));
        }}
        multiline
        error={errors.content}
      />
      <View style={emojiStyles.section}>
        <SectionTitle>Emoji do recado (opcional)</SectionTitle>
        <Text style={emojiStyles.hint}>
          Escolha um emoji para acompanhar o recado.
        </Text>
        <View style={emojiStyles.row}>
          {noteEmojis.map(option => {
            const selected = emoji === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Emoji ${option}`}
                accessibilityState={{ selected }}
                onPress={() => setEmoji(selected ? null : option)}
                style={({ pressed }) => [
                  emojiStyles.option,
                  selected && emojiStyles.optionSelected,
                  pressed && !selected && emojiStyles.optionPressed,
                ]}
              >
                <Text style={emojiStyles.emoji}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ChoiceGroup
        label="Quem pode ver"
        options={visibilityOptions}
        value={visibility}
        onChange={value => {
          setVisibility(value);
          setErrors(current => ({ ...current, visibility: undefined }));
        }}
        error={errors.visibility}
      />
    </Screen>
  );
}

const emojiStyles = StyleSheet.create({
  section: { gap: spacing.sm },
  hint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    width: layout.compactControlHeight,
    height: layout.compactControlHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  emoji: { fontSize: 22, lineHeight: 28 },
});
