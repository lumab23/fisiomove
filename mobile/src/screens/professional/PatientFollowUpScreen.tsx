import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appDependencies } from '../../app/dependencies';
import { friendlyErrorMessage } from '../../api/errors';
import { Icon } from '../../components/Icon';
import { useNativeConfirmation } from '../../components/useNativeConfirmation';
import { useScreenMessage } from '../../components/ScreenMessage';
import { colors, fonts, layout, spacing, typography } from '../../theme/theme';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/ScreenStates';
import type { Note, Workout } from '../../contracts/domain';
import {
  usePatient,
  usePatientNotes,
  usePatientWorkouts,
} from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { Button, Card, ListGroup, ListRow, SectionTitle } from '../../ui';
import { formatSessionDate } from '../patient/SessionRow';
import {
  ResourceView,
  useReloadOnReturn,
  visibilityLabels,
  workoutStatusLabels,
} from './shared';

export function PatientFollowUpScreen() {
  const navigation = useFrontendNavigation();
  const {
    params: { patientId },
  } = useRoute<RouteProp<FrontendStackParamList, 'PatientFollowUp'>>();
  const patient = usePatient(patientId);
  const workouts = usePatientWorkouts(patientId);
  const notes = usePatientNotes(patientId);
  useReloadOnReturn(patient.reload, workouts.reload, notes.reload);
  const name =
    patient.state.status === 'success'
      ? patient.state.data.full_name
      : 'Paciente';
  return (
    <Screen professional back="Acompanhamento" title={name}>
      <SectionTitle>Treinos</SectionTitle>
      <ResourceView resource={workouts} loadingLabel="Carregando treinos">
        {page => (
          <>
            {page.items.length ? (
              <ListGroup>
                {page.items.map(workout => (
                  <ListRow
                    key={workout.id}
                    icon="activity"
                    title={`Treino · ${workoutStatusLabels[workout.status]}`}
                    description={workoutSummary(workout)}
                    onPress={() =>
                      navigation.navigate('WorkoutReview', {
                        patientId,
                        workoutId: workout.id,
                      })
                    }
                  />
                ))}
              </ListGroup>
            ) : (
              <EmptyState
                title="Nenhum treino criado"
                message="Monte o treino com exercícios aprovados do catálogo."
              />
            )}
            <Button
              secondary
              label={page.total > 0 ? 'Criar outro treino' : 'Criar treino'}
              onPress={() =>
                navigation.navigate('WorkoutConfiguration', { patientId })
              }
            />
            <Button
              secondary
              label="Progresso"
              onPress={() =>
                navigation.navigate('ProfessionalPatientProgress', { patientId })
              }
            />
          </>
        )}
      </ResourceView>
      <SectionTitle>Observações</SectionTitle>
      <ResourceView
        resource={notes}
        loadingLabel="Carregando observações"
        empty={
          <EmptyState
            title="Nenhuma observação registrada"
            message="Escreva orientações para o paciente ou anotações só para você."
          />
        }
      >
        {page => (
          <View style={noteStyles.list}>
            {page.items.map(note => (
              <PatientNoteCard
                key={note.id}
                note={note}
                onDeleted={notes.reload}
              />
            ))}
          </View>
        )}
      </ResourceView>
      <Button
        secondary
        label="Escrever observação"
        onPress={() => navigation.navigate('NoteEditor', { patientId })}
      />
    </Screen>
  );
}

function workoutSummary(workout: Workout) {
  const count = workout.items.length;
  return `${count} ${count === 1 ? 'exercício' : 'exercícios'} · versão ${workout.revision_number}`;
}

function preview(note: Note) {
  return note.content.length > 120
    ? `${note.content.slice(0, 117).trimEnd()}…`
    : note.content;
}

function PatientNoteCard({
  note,
  onDeleted,
}: {
  note: Note;
  onDeleted: () => void;
}) {
  const navigation = useFrontendNavigation();
  const confirm = useNativeConfirmation();
  const { show } = useScreenMessage();
  const [deleting, setDeleting] = useState(false);
  const remove = () =>
    confirm({
      title: 'Deseja excluir esta observação?',
      message: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
      onConfirm: async () => {
        setDeleting(true);
        try {
          await appDependencies.notes.delete(note.id);
          show('Observação excluída.', 'success');
          onDeleted();
        } catch (cause) {
          show(
            friendlyErrorMessage(cause, {
              note_author_required:
                'Somente o autor pode excluir esta observação.',
            }),
            'error',
          );
        } finally {
          setDeleting(false);
        }
      },
    });
  return (
    <Card white>
      <View style={noteStyles.header}>
        <Text style={[noteStyles.content, noteStyles.contentBody]}>
          {preview(note)}
        </Text>
        {note.emoji ? <Text style={noteStyles.emoji}>{note.emoji}</Text> : null}
      </View>
      <View style={noteStyles.footer}>
        <Text
          style={noteStyles.metadata}
        >{`${visibilityLabels[note.visibility]} · ${formatSessionDate(note.updated_at)}`}</Text>
        <View style={noteStyles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar observação"
            accessibilityHint={preview(note)}
            accessibilityState={{ disabled: deleting }}
            disabled={deleting}
            onPress={() =>
              navigation.navigate('NoteEditor', {
                patientId: note.patient_id,
                noteId: note.id,
              })
            }
            style={({ pressed }) => [
              noteStyles.action,
              pressed && noteStyles.pressed,
            ]}
          >
            <Icon name="edit" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Excluir observação"
            accessibilityHint={preview(note)}
            accessibilityState={{ disabled: deleting, busy: deleting }}
            disabled={deleting}
            onPress={remove}
            style={({ pressed }) => [
              noteStyles.action,
              pressed && noteStyles.pressed,
            ]}
          >
            <Icon name="trash" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
const noteStyles = StyleSheet.create({
  list: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  content: {
    ...typography.body,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  contentBody: { flex: 1 },
  emoji: { fontSize: 24, lineHeight: 28 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metadata: {
    ...typography.caption,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    flexBasis: 160,
    flexGrow: 1,
  },
  actions: { flexDirection: 'row', marginLeft: 'auto' },
  action: {
    minWidth: layout.compactControlHeight,
    minHeight: layout.compactControlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
