import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/ScreenStates';
import type { OwnNote } from '../../contracts/domain';
import { useMyNotes } from '../../integration/usePatientData';
import { colors, fonts, radii, spacing, typography } from '../../theme/theme';
import { EmptyState, styles } from '../../ui';
import { formatSessionDate } from './SessionRow';

export const notesTitle = 'Recados do fisioterapeuta';

/**
 * Notes the physiotherapist marked "Paciente pode ver" (DEC-015). Read only:
 * there is no reply, chat or contact in the app.
 */
export function PatientNotesScreen() {
  const { state, reload } = useMyNotes();
  let content: React.ReactNode;
  if (state.status === 'idle' || state.status === 'loading') {
    content = <LoadingState label="Carregando os recados" />;
  } else if (state.status === 'failure') {
    content = (
      <ErrorState
        title="Não foi possível carregar os recados"
        message={state.message}
        onRetry={reload}
      />
    );
  } else if (state.status === 'empty') {
    content = (
      <EmptyState title="Nenhum recado">
        Seu fisioterapeuta ainda não deixou recados.
      </EmptyState>
    );
  } else {
    content = state.data.items.map(note => (
      <NoteCard key={note.id} note={note} />
    ));
  }
  return (
    <Screen back="Voltar" title={notesTitle}>
      {content}
    </Screen>
  );
}

const EDIT_THRESHOLD_MS = 60_000;

function NoteCard({ note }: { note: OwnNote }) {
  const date = formatSessionDate(note.created_at);
  // The backend stamps `created_at` and `updated_at` separately, so a note that
  // was never edited differs by microseconds; only a real edit (> 1 min) counts.
  const edited =
    Date.parse(note.updated_at) - Date.parse(note.created_at) >
    EDIT_THRESHOLD_MS
      ? `Atualizado em ${formatSessionDate(note.updated_at)}`
      : null;
  return (
    <View
      accessible
      accessibilityLabel={`Recado de ${date}. ${note.content}${note.emoji ? `. Emoji ${note.emoji}` : ''}${edited ? `. ${edited}` : ''}`}
      style={[styles.white, notes.card]}
    >
      <View style={notes.header}>
        <View style={notes.body}>
          <Text style={notes.date}>{date}</Text>
          <Text style={notes.content}>{note.content}</Text>
          {edited ? <Text style={notes.date}>{edited}</Text> : null}
        </View>
        {note.emoji ? (
          <Text accessibilityElementsHidden importantForAccessibility="no" style={notes.emoji}>
            {note.emoji}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const notes = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  body: { flex: 1, gap: spacing.sm },
  date: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  content: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  emoji: { fontSize: 28, lineHeight: 32 },
});
