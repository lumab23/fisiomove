import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { EmptyState, InlineError } from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { UUID } from '../../contracts/common';
import type {
  Exercise,
  Side,
  Workout,
  WorkoutItem,
  WorkoutItemInput,
  WorkoutWrite,
} from '../../contracts/domain';
import type { Resource } from '../../integration/usePatientData';
import {
  useApprovedExercises,
  useWorkout,
} from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { Badge, Body, Button, Card, Link, SectionTitle } from '../../ui';
import { formatSessionDate } from '../patient/SessionRow';
import { ExerciseImageGallery } from '../../components/ExerciseImageGallery';
import {
  exerciseImages,
  exerciseLocalization,
  exerciseName,
  exerciseSourceText,
  exerciseText,
  originalLanguageSeal,
  prescriptionText,
  sideLabels,
} from '../patient/workoutText';
import { CatalogExerciseText } from './ExerciseTranslation';
import {
  apiErrorMessage,
  ChoiceGroup,
  ResourceView,
  restText,
  useReloadOnReturn,
  workoutStatusLabels,
} from './shared';

const workoutErrors: Record<string, string> = {
  parameter_contract_pending:
    'Um dos exercícios ainda depende de um validador de parâmetros aprovado e não pode entrar em treinos por enquanto. Escolha outro exercício.',
  unsupported_side:
    'O lado escolhido não é permitido para um dos exercícios. Escolha um dos lados disponíveis.',
  unsupported_parameters: 'Um dos exercícios não aceita parâmetros adicionais.',
  exercise_not_found:
    'Um dos exercícios não está mais aprovado no catálogo. Escolha outro.',
  workout_archived: 'Este treino foi arquivado e não pode mais ser editado.',
  workout_not_draft:
    'Só é possível publicar um treino em rascunho. Atualize a tela.',
};

/**
 * Editable copy of a workout item. Every value starts empty for a new item:
 * sets, repetitions, rest and side are typed or chosen by the physiotherapist.
 */
type ItemDraft = {
  key: string;
  exerciseId: UUID | null;
  side: Side | null;
  sets: string;
  repetitions: string;
  restSeconds: string;
  /** Optional text for the patient (Q-P2); typed by the physiotherapist. */
  professionalGuidance: string;
};

type ItemErrors = Partial<
  Record<'exercise' | 'side' | 'sets' | 'repetitions' | 'rest', string>
>;

const positiveInteger = /^\d+$/;
const nonnegativeNumber = /^\d+([.,]\d{1,3})?$/;

/** Converts drafts with patient-facing pt-BR instructions to the API payload. */
export function buildWorkoutItems(
  drafts: ItemDraft[],
  catalog: Exercise[],
): { items: WorkoutItemInput[] } | { errors: ItemErrors[] } {
  const errors: ItemErrors[] = [];
  const items: WorkoutItemInput[] = [];
  drafts.forEach((draft, index) => {
    const item: ItemErrors = {};
    const exercise = catalog.find(entry => entry.id === draft.exerciseId);
    if (!exercise) {
      item.exercise = 'Escolha um exercício do catálogo.';
    } else if (exercise.source && !exerciseLocalization(exercise)) {
      item.exercise =
        'Adicione e revise a tradução em português antes de salvar.';
    }
    if (
      !draft.side ||
      (exercise && !exercise.allowed_sides.includes(draft.side))
    ) {
      item.side = 'Escolha o lado.';
    }
    const sets = draft.sets.trim();
    if (!positiveInteger.test(sets) || Number(sets) < 1) {
      item.sets = 'Informe as séries com um número inteiro maior que zero.';
    }
    const repetitions = draft.repetitions.trim();
    if (!positiveInteger.test(repetitions) || Number(repetitions) < 1) {
      item.repetitions =
        'Informe as repetições com um número inteiro maior que zero.';
    }
    const rest = draft.restSeconds.trim();
    if (!nonnegativeNumber.test(rest)) {
      item.rest = 'Informe o descanso em segundos (pode ser 0).';
    }
    errors.push(item);
    if (Object.keys(item).length === 0 && draft.exerciseId && draft.side) {
      items.push({
        position: index + 1,
        exercise_id: draft.exerciseId,
        side: draft.side,
        sets: Number(sets),
        repetitions: Number(repetitions),
        rest_duration_ms: Math.round(Number(rest.replace(',', '.')) * 1000),
        professional_guidance: draft.professionalGuidance.trim() || null,
      });
    }
  });
  return errors.some(item => Object.keys(item).length) ? { errors } : { items };
}

function draftsFrom(workout: Workout | null, nextKey: () => string) {
  if (!workout) {
    return [emptyDraft(nextKey())];
  }
  return [...workout.items]
    .sort((a, b) => a.position - b.position)
    .map(item => ({
      key: nextKey(),
      exerciseId: item.exercise_id,
      side: item.side,
      sets: String(item.sets),
      repetitions: String(item.repetitions),
      restSeconds: String(item.rest_duration_ms / 1000),
      professionalGuidance: item.professional_guidance ?? '',
    }));
}

function emptyDraft(key: string): ItemDraft {
  return {
    key,
    exerciseId: null,
    side: null,
    sets: '',
    repetitions: '',
    restSeconds: '',
    professionalGuidance: '',
  };
}

export function WorkoutConfigurationScreen() {
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'WorkoutConfiguration'>>();
  const catalog = useApprovedExercises();
  return params.workoutId ? (
    <EditWorkout
      patientId={params.patientId}
      workoutId={params.workoutId}
      catalog={catalog}
    />
  ) : (
    <ConfigurationLoader catalog={catalog} patientId={params.patientId} />
  );
}

function EditWorkout({
  patientId,
  workoutId,
  catalog,
}: {
  patientId: UUID;
  workoutId: UUID;
  catalog: Resource<{ items: Exercise[] }>;
}) {
  const workout = useWorkout(workoutId);
  return (
    <ConfigurationLoader
      catalog={catalog}
      patientId={patientId}
      workout={workout}
    />
  );
}

function ConfigurationLoader({
  catalog,
  patientId,
  workout,
}: {
  catalog: Resource<{ items: Exercise[] }>;
  patientId: UUID;
  workout?: Resource<Workout>;
}) {
  const editing = Boolean(workout);
  const title = editing ? 'Editar treino' : 'Criar treino';
  const state = (content: ReactNode) => (
    <Screen professional back="Paciente" title={title}>
      {content}
    </Screen>
  );
  if (workout && workout.state.status !== 'success') {
    return state(
      <ResourceView resource={workout} loadingLabel="Carregando treino">
        {() => null}
      </ResourceView>,
    );
  }
  const current =
    workout?.state.status === 'success' ? workout.state.data : null;
  if (current?.status === 'archived') {
    return state(
      <EmptyState
        title="Treino arquivado"
        message="Treinos arquivados não podem ser editados. Crie um novo treino se precisar."
      />,
    );
  }
  // An empty catalog does not block the form: items can come from the
  // reference library ("Buscar na biblioteca de referência").
  if (catalog.state.status !== 'success' && catalog.state.status !== 'empty') {
    return state(
      <ResourceView resource={catalog} loadingLabel="Carregando exercícios">
        {() => null}
      </ResourceView>,
    );
  }
  return (
    <WorkoutForm
      title={title}
      patientId={patientId}
      workout={current}
      catalog={catalog.state.data.items}
    />
  );
}

function WorkoutForm({
  title,
  patientId,
  workout,
  catalog: initialCatalog,
}: {
  title: string;
  patientId: UUID;
  workout: Workout | null;
  catalog: Exercise[];
}) {
  const navigation = useFrontendNavigation();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'WorkoutConfiguration'>>();
  const { show } = useScreenMessage();
  // Grows with exercises added from the library while the editor is open.
  const [catalog, setCatalog] = useState(initialCatalog);
  const counter = useRef(0);
  const nextKey = () => `item-${(counter.current += 1)}`;
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    draftsFrom(workout, nextKey),
  );
  const [instructions, setInstructions] = useState(workout?.instructions ?? '');
  const [errors, setErrors] = useState<ItemErrors[]>([]);
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key: string, change: Partial<ItemDraft>) => {
    setDrafts(current =>
      current.map(draft =>
        draft.key === key ? { ...draft, ...change } : draft,
      ),
    );
    setErrors([]);
  };
  // Exercise chosen in the library (pick mode): fills only that item's
  // exercise; sets, repetitions and rest stay as typed (empty for a new item).
  const picked = params.picked;
  const handled = useRef<typeof picked>(undefined);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!picked || handled.current === picked) {
      return;
    }
    handled.current = picked;
    appDependencies.exercises.get(picked.exerciseId).then(
      exercise => {
        if (!mounted.current) {
          return;
        }
        setCatalog(current => [
          ...current.filter(entry => entry.id !== exercise.id),
          exercise,
        ]);
        setDrafts(current =>
          current.map(draft =>
            draft.key === picked.itemKey
              ? {
                  ...draft,
                  exerciseId: exercise.id,
                  side:
                    draft.side && exercise.allowed_sides.includes(draft.side)
                      ? draft.side
                      : null,
                }
              : draft,
          ),
        );
        setErrors([]);
        setFailure('');
      },
      (cause: unknown) => {
        if (mounted.current) {
          setFailure(apiErrorMessage(cause, workoutErrors));
        }
      },
    );
  }, [picked]);
  // Back from the translation screen: reload that exercise so the editor shows
  // the new text. Saving sends the items again, so the next snapshot has it.
  const translating = useRef<UUID | null>(null);
  useReloadOnReturn(() => {
    const exerciseId = translating.current;
    translating.current = null;
    if (!exerciseId) {
      return;
    }
    appDependencies.exercises.get(exerciseId).then(
      exercise => {
        if (mounted.current) {
          setCatalog(current =>
            current.map(entry => (entry.id === exercise.id ? exercise : entry)),
          );
        }
      },
      () => undefined,
    );
  });
  const editTranslation = (exerciseId: UUID) => {
    translating.current = exerciseId;
    navigation.navigate('CatalogExerciseTranslation', { exerciseId });
  };
  const searchLibrary = (itemKey: string) =>
    navigation.navigate('ExerciseLibrary', {
      pickFor: { patientId, workoutId: workout?.id, itemKey },
    });
  const save = async () => {
    if (saving) {
      return;
    }
    setFailure('');
    const built = buildWorkoutItems(drafts, catalog);
    if ('errors' in built) {
      setErrors(built.errors);
      setFailure('Confira os campos destacados.');
      return;
    }
    const payload: WorkoutWrite = {
      instructions: instructions.trim() || null,
      items: built.items,
    };
    setSaving(true);
    try {
      const saved = workout
        ? await appDependencies.workouts.update(workout.id, payload)
        : await appDependencies.workouts.create(patientId, payload);
      show('Rascunho salvo. Revise e publique para o paciente ver.');
      if (workout) {
        navigation.goBack();
      } else {
        navigation.replace('WorkoutReview', {
          patientId,
          workoutId: saved.id,
        });
      }
    } catch (cause) {
      setFailure(apiErrorMessage(cause, workoutErrors));
      setSaving(false);
    }
  };
  return (
    <Screen
      professional
      back="Paciente"
      title={title}
      footer={
        <Button
          label={saving ? 'Salvando…' : 'Salvar rascunho'}
          disabled={saving}
          onPress={save}
        />
      }
    >
      <Body>
        Use exercícios do catálogo ou adicione da biblioteca de referência.
      </Body>
      <Body>
        Séries, repetições e descanso são definidos por você; nenhum valor é
        preenchido automaticamente.
      </Body>
      {workout?.status === 'published' ? (
        <Body>
          Ao salvar, o treino volta a ser rascunho e deixa de aparecer para o
          paciente até ser publicado de novo.
        </Body>
      ) : null}
      {failure ? <InlineError message={failure} /> : null}
      {drafts.map((draft, index) => (
        <ItemEditor
          key={draft.key}
          index={index}
          draft={draft}
          catalog={catalog}
          errors={errors[index] ?? {}}
          onChange={change => update(draft.key, change)}
          onSearchLibrary={() => searchLibrary(draft.key)}
          onEditTranslation={editTranslation}
          onRemove={
            drafts.length > 1
              ? () => {
                  setDrafts(current =>
                    current.filter(entry => entry.key !== draft.key),
                  );
                  setErrors([]);
                }
              : undefined
          }
        />
      ))}
      <Button
        secondary
        label="Adicionar outro exercício"
        onPress={() => {
          setDrafts(current => [...current, emptyDraft(nextKey())]);
          setErrors([]);
        }}
      />
      <FormField
        label="Orientações gerais (opcional)"
        value={instructions}
        onChangeText={setInstructions}
        multiline
      />
    </Screen>
  );
}

/** pt-BR name with the original in parentheses, or just the original. */
function catalogLabel(exercise: Exercise) {
  const localization = exerciseLocalization(exercise);
  return localization
    ? `${localization.name} (original: ${exercise.name})`
    : exercise.name;
}

function ItemEditor({
  index,
  draft,
  catalog,
  errors,
  onChange,
  onSearchLibrary,
  onEditTranslation,
  onRemove,
}: {
  index: number;
  draft: ItemDraft;
  catalog: Exercise[];
  errors: ItemErrors;
  onChange: (change: Partial<ItemDraft>) => void;
  onSearchLibrary: () => void;
  onEditTranslation: (exerciseId: UUID) => void;
  onRemove?: () => void;
}) {
  const exercise = catalog.find(entry => entry.id === draft.exerciseId);
  const missing = draft.exerciseId !== null && !exercise;
  return (
    <Card white title={`Exercício ${index + 1}`}>
      {missing ? (
        <InlineError message="O exercício anterior não está mais aprovado no catálogo. Escolha outro." />
      ) : null}
      {catalog.length ? null : (
        <Body>O catálogo ainda não tem exercícios.</Body>
      )}
      <ChoiceGroup
        label="Exercício"
        options={catalog.map(entry => [entry.id, catalogLabel(entry)] as const)}
        value={exercise ? exercise.id : null}
        onChange={exerciseId => {
          const next = catalog.find(entry => entry.id === exerciseId);
          onChange({
            exerciseId,
            side:
              draft.side && next?.allowed_sides.includes(draft.side)
                ? draft.side
                : null,
          });
        }}
        error={errors.exercise}
      />
      <Button
        secondary
        compact
        label="Buscar na biblioteca de referência"
        onPress={onSearchLibrary}
      />
      {exercise ? (
        <>
          <CatalogExerciseText
            exercise={exercise}
            onEditTranslation={() => onEditTranslation(exercise.id)}
          />
          {Object.keys(exercise.supported_parameters).length ? (
            <InlineError message="Este exercício ainda depende de um validador de parâmetros aprovado e não pode entrar em treinos por enquanto." />
          ) : null}
          <ChoiceGroup
            label="Lado"
            options={exercise.allowed_sides.map(
              side => [side, sideLabels[side]] as const,
            )}
            value={draft.side}
            onChange={side => onChange({ side })}
            error={errors.side}
          />
        </>
      ) : null}
      <FormField
        label="Séries"
        value={draft.sets}
        onChangeText={sets => onChange({ sets })}
        keyboardType="number-pad"
        error={errors.sets}
      />
      <FormField
        label="Repetições por série"
        value={draft.repetitions}
        onChangeText={repetitions => onChange({ repetitions })}
        keyboardType="number-pad"
        error={errors.repetitions}
      />
      <FormField
        label="Descanso entre séries (segundos)"
        value={draft.restSeconds}
        onChangeText={restSeconds => onChange({ restSeconds })}
        keyboardType="decimal-pad"
        error={errors.rest}
      />
      <FormField
        label="Orientação para o paciente (opcional)"
        value={draft.professionalGuidance}
        onChangeText={professionalGuidance =>
          onChange({ professionalGuidance })
        }
        multiline
      />
      {onRemove ? (
        <Link label="Remover este exercício" onPress={onRemove} />
      ) : null}
    </Card>
  );
}

export function WorkoutReviewScreen() {
  const navigation = useFrontendNavigation();
  const { show } = useScreenMessage();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'WorkoutReview'>>();
  const { patientId, workoutId } = params;
  const workout = useWorkout(workoutId);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [failure, setFailure] = useState('');
  useReloadOnReturn(workout.reload);
  const run = async (action: 'publish' | 'archive') => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure('');
    try {
      if (action === 'publish') {
        await appDependencies.workouts.publish(workoutId);
        show('Treino publicado. O paciente já pode vê-lo.');
      } else {
        await appDependencies.workouts.archive(workoutId);
        show('Treino arquivado.');
      }
      setConfirmArchive(false);
      workout.reload();
    } catch (cause) {
      setFailure(apiErrorMessage(cause, workoutErrors));
    } finally {
      setBusy(false);
    }
  };
  const data = workout.state.status === 'success' ? workout.state.data : null;
  const edit = () =>
    navigation.navigate('WorkoutConfiguration', { patientId, workoutId });
  return (
    <Screen
      professional
      back="Paciente"
      title="Revisar treino"
      footer={
        data?.status === 'draft' ? (
          <Button
            label={busy ? 'Publicando…' : 'Publicar treino'}
            disabled={busy}
            onPress={() => run('publish')}
          />
        ) : undefined
      }
    >
      {failure ? <InlineError message={failure} /> : null}
      <ResourceView resource={workout} loadingLabel="Carregando treino">
        {current => (
          <>
            <Badge
              label={workoutStatusLabels[current.status]}
              tone={current.status === 'published' ? 'success' : 'neutral'}
            />
            <Body>
              {current.published_at && current.status === 'published'
                ? `Versão ${current.revision_number}, publicada em ${formatSessionDate(current.published_at)}.`
                : `Versão ${current.revision_number}.`}
            </Body>
            {current.status === 'draft' ? (
              <Body>O paciente só vê o treino depois que ele é publicado.</Body>
            ) : null}
            {current.status === 'archived' ? (
              <Body>
                Treino arquivado. Ele não aparece para o paciente e não pode ser
                editado.
              </Body>
            ) : null}
            {[...current.items]
              .sort((a, b) => a.position - b.position)
              .map(item => (
                <ReviewItem
                  key={item.id}
                  item={item}
                  onEditTranslation={() =>
                    navigation.navigate('CatalogExerciseTranslation', {
                      exerciseId: item.exercise_id,
                    })
                  }
                />
              ))}
            {current.instructions ? (
              <>
                <SectionTitle>Orientações gerais</SectionTitle>
                <Body>{current.instructions}</Body>
              </>
            ) : null}
            {current.status !== 'archived' ? (
              confirmArchive ? (
                <Card white title="Arquivar este treino?">
                  <Body>
                    O paciente deixará de vê-lo e ele não poderá mais ser
                    editado. As sessões já registradas continuam no histórico.
                  </Body>
                  <Button
                    label={busy ? 'Arquivando…' : 'Arquivar treino'}
                    disabled={busy}
                    onPress={() => run('archive')}
                  />
                  <Link
                    label="Cancelar"
                    onPress={() => setConfirmArchive(false)}
                  />
                </Card>
              ) : (
                <>
                  <Button secondary label="Editar treino" onPress={edit} />
                  <Link
                    label="Arquivar treino"
                    onPress={() => setConfirmArchive(true)}
                  />
                </>
              )
            ) : null}
          </>
        )}
      </ResourceView>
    </Screen>
  );
}

/**
 * One published/draft item as the patient will see it (snapshot): pt-BR name
 * when translated, the original name, the first image and the source.
 */
function ReviewItem({
  item,
  onEditTranslation,
}: {
  item: WorkoutItem;
  onEditTranslation: () => void;
}) {
  const text = exerciseText(item);
  const source = exerciseSourceText(item);
  const localized = exerciseLocalization(item.exercise_snapshot);
  const originalName = item.exercise_snapshot.name;
  return (
    <Card white title={exerciseName(item)}>
      {localized && typeof originalName === 'string' ? (
        <Body>{`Nome da biblioteca: ${originalName}`}</Body>
      ) : null}
      {text.original ? <Badge label={originalLanguageSeal} /> : null}
      <ExerciseImageGallery
        limit={1}
        images={exerciseImages(item.exercise_snapshot)}
        exerciseName={text.name}
      />
      <Body>{prescriptionText(item)}</Body>
      <Body>{restText(item)}</Body>
      {item.professional_guidance ? (
        <Body>{item.professional_guidance}</Body>
      ) : null}
      {source ? (
        <>
          <Body>{source}</Body>
          <Link label="Tradução em português" onPress={onEditTranslation} />
        </>
      ) : null}
    </Card>
  );
}
