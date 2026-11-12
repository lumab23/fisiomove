import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { colors, fonts, layout, spacing, typography } from '../../theme/theme';
import { useNativeConfirmation } from '../../components/useNativeConfirmation';
import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import {
  EmptyState,
  InlineError,
  LoadingState,
} from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { UUID } from '../../contracts/common';
import type {
  CountingRule,
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
import { Badge, Body, Button, Card, SectionTitle } from '../../ui';
import { formatSessionDate } from '../patient/SessionRow';
import { ExerciseImageGallery } from '../../components/ExerciseImageGallery';
import {
  exerciseImages,
  exerciseLocalization,
  exerciseName,
  prescribedSideLabels,
  prescriptionText,
} from '../patient/workoutText';
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
  workout_archived: 'Este treino está arquivado.',
  workout_not_archived: 'Este treino não está arquivado. Atualize a tela.',
  workout_not_draft:
    'Para publicar, salve como rascunho. Para apagar um treino publicado, arquive-o primeiro.',
  workout_has_sessions:
    'Este treino já tem sessões registradas e não pode ser apagado.',
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
  /** Demonstration counting by the camera (DEC-013); off by default. */
  automaticCounting: boolean;
};

/** The only counting rule the app runs; not clinically validated (DEC-013). */
const demoCountingRule: CountingRule = 'demo-elbow-flexion:v1';

const automaticCountingLabel =
  'Contagem automática demonstrativa (flexão de cotovelo)';
const automaticCountingNotice =
  'Não validada clinicamente; os valores são de demonstração acadêmica.';

/** Automatic counting follows one arm, so it needs the left or right side. */
function oneSided(side: Side | null): side is 'left' | 'right' {
  return side === 'left' || side === 'right';
}

/**
 * The side of an item: the one chosen, or the exercise's only allowed side.
 * With more than one allowed side nothing is assumed: the physiotherapist
 * chooses it in the card.
 */
function itemSide(draft: ItemDraft, exercise?: Exercise): Side | null {
  if (draft.side) {
    return draft.side;
  }
  return exercise?.allowed_sides.length === 1
    ? exercise.allowed_sides[0]
    : null;
}

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
  if (!drafts.length)
    return {
      errors: [{ exercise: 'Adicione pelo menos um exercício ao treino.' }],
    };
  const errors: ItemErrors[] = [];
  const items: WorkoutItemInput[] = [];
  drafts.forEach((draft, index) => {
    const item: ItemErrors = {};
    const exercise = catalog.find(entry => entry.id === draft.exerciseId);
    if (!exercise) {
      item.exercise = 'Escolha um exercício do catálogo.';
    }
    const side = itemSide(draft, exercise);
    if (!side || (exercise && !exercise.allowed_sides.includes(side))) {
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
    if (Object.keys(item).length === 0 && draft.exerciseId && side) {
      items.push({
        position: index + 1,
        exercise_id: draft.exerciseId,
        side,
        sets: Number(sets),
        repetitions: Number(repetitions),
        rest_duration_ms: Math.round(Number(rest.replace(',', '.')) * 1000),
        professional_guidance: draft.professionalGuidance.trim() || null,
        counting_rule:
          draft.automaticCounting && oneSided(side) ? demoCountingRule : null,
      });
    }
  });
  return errors.some(item => Object.keys(item).length) ? { errors } : { items };
}

function draftsFrom(workout: Workout | null, nextKey: () => string) {
  if (!workout) {
    return [];
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
      automaticCounting: item.counting_rule === demoCountingRule,
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
    automaticCounting: false,
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
  // An empty catalog does not block the form.
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
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const selectedCard = useRef<string | null>(null);
  const positions = useRef(new Map<string, number>()).current;
  const counter = useRef(0);
  const nextKey = () => `item-${(counter.current += 1)}`;
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    draftsFrom(workout, nextKey),
  );
  // Reveal the selected card without adding any navigation animation.
  useEffect(() => {
    const key = selectedCard.current;
    const y = key ? positions.get(key) : undefined;
    if (!key || y === undefined) return;
    const frame = requestAnimationFrame(() => {
      if (selectedCard.current === key) {
        scroll.current?.scrollTo({ y, animated: false });
        selectedCard.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [drafts, positions]);
  // No longer edited here (the item's own guidance replaces it), but an
  // existing text is kept when the workout is saved again.
  const instructions = workout?.instructions ?? '';
  const [errors, setErrors] = useState<ItemErrors[]>([]);
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const update = (key: string, change: Partial<ItemDraft>) => {
    setDrafts(current =>
      current.map(draft =>
        draft.key === key ? { ...draft, ...change } : draft,
      ),
    );
    setErrors([]);
  };
  // Both the catalog picker and library import return only IDs. Existing
  // cards keep their values; new cards start without a clinical prescription.
  const picked = params.picked;
  const handled = useRef<typeof picked>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!picked || handled.current === picked) {
      return;
    }
    handled.current = picked;
    setSelecting(true);
    const cached = catalog.find(entry => entry.id === picked.exerciseId);
    const selection = cached
      ? Promise.resolve(cached)
      : appDependencies.exercises.get(picked.exerciseId);
    selection
      .then(
        exercise => {
          if (!mounted.current || handled.current !== picked) {
            return;
          }
          setCatalog(current => [
            ...current.filter(entry => entry.id !== exercise.id),
            exercise,
          ]);
          selectedCard.current = picked.itemKey;
          // The picker may append a new card or replace an existing exercise.
          setDrafts(current => {
            const existing = current.find(
              draft => draft.key === picked.itemKey,
            );
            if (!existing)
              return [
                ...current,
                { ...emptyDraft(picked.itemKey), exerciseId: exercise.id },
              ];
            return current.map(draft => {
              if (draft.key !== picked.itemKey) return draft;
              const side =
                draft.side && exercise.allowed_sides.includes(draft.side)
                  ? draft.side
                  : null;
              return {
                ...draft,
                exerciseId: exercise.id,
                side,
                automaticCounting: draft.automaticCounting && oneSided(side),
              };
            });
          });
          setErrors([]);
        },
        (cause: unknown) => {
          if (mounted.current) {
            show(apiErrorMessage(cause, workoutErrors), 'error');
          }
        },
      )
      .finally(() => {
        if (mounted.current && handled.current === picked) setSelecting(false);
      });
  }, [picked, show, catalog]);
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
  const chooseExercise = (itemKey = nextKey()) =>
    navigation.navigate('WorkoutExercisePicker', {
      patientId,
      workoutId: workout?.id,
      itemKey,
    });
  const save = async () => {
    if (saving || selecting) {
      return;
    }
    if (!drafts.length) {
      show('Adicione pelo menos um exercício ao treino.', 'error');
      return;
    }
    const built = buildWorkoutItems(drafts, catalog);
    if ('errors' in built) {
      setErrors(built.errors);
      show('Confira os campos destacados.', 'error');
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
      show('Rascunho salvo. Revise e publique para o paciente ver.', 'success');
      if (workout) {
        navigation.goBack();
      } else {
        navigation.replace('WorkoutReview', {
          patientId,
          workoutId: saved.id,
        });
      }
    } catch (cause) {
      show(apiErrorMessage(cause, workoutErrors), 'error');
      setSaving(false);
    }
  };
  return (
    <Screen professional back="Paciente" title={title} scrollRef={scroll}>
      {!drafts.length ? (
        <EmptyState
          title="Adicione os exercícios do treino"
          message="Escolha no catálogo e configure a prescrição em cada card."
        />
      ) : null}
      {workout?.status === 'published' || workout?.status === 'archived' ? (
        <Body>
          Ao salvar, o treino volta a ser rascunho e deixa de aparecer para o
          paciente até ser publicado de novo.
        </Body>
      ) : null}
      {selecting ? (
        <LoadingState label="Adicionando exercício ao treino" />
      ) : null}
      {drafts.map((draft, index) => (
        <View
          key={draft.key}
          onLayout={({ nativeEvent }) => {
            const y = nativeEvent.layout.y;
            positions.set(draft.key, y);
            if (selectedCard.current === draft.key)
              requestAnimationFrame(() => {
                if (selectedCard.current === draft.key) {
                  scroll.current?.scrollTo({ y, animated: false });
                  selectedCard.current = null;
                }
              });
          }}
        >
          <ItemEditor
            index={index}
            draft={draft}
            catalog={catalog}
            errors={errors[index] ?? {}}
            onChange={change => update(draft.key, change)}
            onChooseExercise={() => chooseExercise(draft.key)}
            onEditTranslation={editTranslation}
            onRemove={() => {
              setDrafts(current =>
                current.filter(entry => entry.key !== draft.key),
              );
              positions.delete(draft.key);
              setErrors([]);
            }}
          />
        </View>
      ))}
      {/* Each pick appends its own card; the previous cards are kept. */}
      <Button
        secondary
        icon="plus"
        label="Adicionar exercício"
        disabled={selecting}
        onPress={() => chooseExercise()}
      />
      <Button
        label={
          saving ? 'Salvando…' : workout ? 'Salvar rascunho' : 'Criar treino'
        }
        disabled={saving || selecting}
        onPress={save}
      />
    </Screen>
  );
}

function ItemEditor({
  index,
  draft,
  catalog,
  errors,
  onChange,
  onChooseExercise,
  onEditTranslation,
  onRemove,
}: {
  index: number;
  draft: ItemDraft;
  catalog: Exercise[];
  errors: ItemErrors;
  onChange: (change: Partial<ItemDraft>) => void;
  onChooseExercise: () => void;
  onEditTranslation: (exerciseId: UUID) => void;
  onRemove: () => void;
}) {
  const exercise = catalog.find(entry => entry.id === draft.exerciseId);
  const missing = draft.exerciseId !== null && !exercise;
  const localization = exercise ? exerciseLocalization(exercise) : null;
  const name = localization?.name ?? exercise?.name ?? `Exercício ${index + 1}`;
  const setCount = Number(draft.sets);
  const actions: {
    icon: IconName;
    label: string;
    onPress: () => void;
  }[] = [
    ...(exercise
      ? [
          {
            icon: 'edit' as const,
            label: 'Editar nome do exercício',
            onPress: () => onEditTranslation(exercise.id),
          },
        ]
      : []),
    { icon: 'swap', label: 'Trocar exercício', onPress: onChooseExercise },
    { icon: 'trash', label: 'Remover este exercício', onPress: onRemove },
  ];

  return (
    <Card white>
      <View style={editorStyles.cardHeader}>
        <Text accessibilityRole="header" style={editorStyles.exerciseTitle}>
          {name}
        </Text>
        <View style={editorStyles.actions}>
          {actions.map(action => (
            <Pressable
              key={action.icon}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={name}
              onPress={action.onPress}
              style={({ pressed }) => [
                editorStyles.iconButton,
                pressed && editorStyles.iconPressed,
              ]}
            >
              <Icon
                name={action.icon}
                size={20}
                color={
                  action.icon === 'trash' ? colors.textMuted : colors.primary
                }
              />
            </Pressable>
          ))}
        </View>
      </View>
      {missing ? (
        <InlineError message="O exercício anterior não está mais aprovado no catálogo. Escolha outro." />
      ) : null}
      {errors.exercise ? (
        <InlineError static message={errors.exercise} />
      ) : null}
      {exercise && Object.keys(exercise.supported_parameters).length ? (
        <InlineError message="Este exercício ainda depende de um validador de parâmetros aprovado e não pode entrar em treinos por enquanto." />
      ) : null}
      {/* The side is asked only when the exercise allows more than one. */}
      {exercise && exercise.allowed_sides.length > 1 ? (
        <ChoiceGroup
          label="Lado"
          options={exercise.allowed_sides.map(
            side => [side, prescribedSideLabels[side]] as const,
          )}
          value={draft.side}
          onChange={side =>
            onChange({
              side,
              automaticCounting: draft.automaticCounting && oneSided(side),
            })
          }
          error={errors.side}
        />
      ) : null}
      <View style={editorStyles.seriesRow}>
        <View style={editorStyles.seriesField}>
          <FormField
            label="Séries"
            value={draft.sets}
            onChangeText={sets => onChange({ sets })}
            keyboardType="number-pad"
            error={errors.sets}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remover série"
          accessibilityHint={name}
          accessibilityState={{
            disabled: !positiveInteger.test(draft.sets) || setCount <= 1,
          }}
          disabled={!positiveInteger.test(draft.sets) || setCount <= 1}
          onPress={() => onChange({ sets: String(setCount - 1) })}
          style={editorStyles.iconButton}
        >
          <Text style={editorStyles.stepper}>−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar série"
          accessibilityHint={name}
          onPress={() =>
            onChange({
              sets: String(
                positiveInteger.test(draft.sets) && setCount > 0
                  ? setCount + 1
                  : 1,
              ),
            })
          }
          style={editorStyles.iconButton}
        >
          <Text style={editorStyles.stepper}>+</Text>
        </Pressable>
      </View>
      <FormField
        label="Repetições por série"
        value={draft.repetitions}
        onChangeText={repetitions => onChange({ repetitions })}
        keyboardType="number-pad"
        error={errors.repetitions}
      />
      <FormField
        label="Descanso (em segundos)"
        value={draft.restSeconds}
        onChangeText={restSeconds => onChange({ restSeconds })}
        keyboardType="decimal-pad"
        error={errors.rest}
      />
      <FormField
        label="Orientação para o paciente"
        value={draft.professionalGuidance}
        onChangeText={professionalGuidance =>
          onChange({ professionalGuidance })
        }
        multiline
      />
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
  const confirmArchive = useNativeConfirmation();
  useReloadOnReturn(workout.reload);
  const run = async (
    action: 'publish' | 'archive' | 'unarchive' | 'delete',
  ) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      if (action === 'publish') {
        await appDependencies.workouts.publish(workoutId);
        show('Treino publicado. O paciente já pode vê-lo.', 'success');
        workout.reload();
      } else if (action === 'archive') {
        await appDependencies.workouts.archive(workoutId);
        show('Treino arquivado.', 'success');
        workout.reload();
      } else if (action === 'unarchive') {
        await appDependencies.workouts.unarchive(workoutId);
        show(
          'Treino desarquivado. Revise e publique para o paciente ver.',
          'success',
        );
        workout.reload();
      } else {
        await appDependencies.workouts.delete(workoutId);
        show('Treino apagado.', 'success');
        navigation.goBack();
        return;
      }
    } catch (cause) {
      show(apiErrorMessage(cause, workoutErrors), 'error');
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
            {[...current.items]
              .sort((a, b) => a.position - b.position)
              .map(item => (
                <ReviewItem key={item.id} item={item} />
              ))}
            {current.instructions ? (
              <>
                <SectionTitle>Orientações gerais</SectionTitle>
                <Body>{current.instructions}</Body>
              </>
            ) : null}
            <View style={editorStyles.reviewActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar treino"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={edit}
                style={({ pressed }) => [
                  editorStyles.iconButton,
                  pressed && editorStyles.iconPressed,
                ]}
              >
                <Icon name="edit" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  current.status === 'archived'
                    ? 'Desarquivar treino'
                    : 'Arquivar treino'
                }
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() =>
                  confirmArchive({
                    title:
                      current.status === 'archived'
                        ? 'Desarquivar este treino?'
                        : 'Arquivar este treino?',
                    message:
                      current.status === 'archived'
                        ? 'O treino voltará a ser rascunho. Revise e publique quando estiver pronto.'
                        : 'O treino deixará de aparecer para o paciente. As sessões já registradas continuam no histórico.',
                    destructive: current.status !== 'archived',
                    onConfirm: () =>
                      run(
                        current.status === 'archived' ? 'unarchive' : 'archive',
                      ),
                  })
                }
                style={({ pressed }) => [
                  editorStyles.iconButton,
                  pressed && editorStyles.iconPressed,
                ]}
              >
                <Icon
                  name={current.status === 'archived' ? 'unarchive' : 'archive'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {current.status !== 'published' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Apagar treino"
                  accessibilityState={{ disabled: busy, busy }}
                  disabled={busy}
                  onPress={() =>
                    confirmArchive({
                      title: 'Apagar este treino?',
                      message:
                        'Este treino será removido. Esta ação não pode ser desfeita. Treinos com sessões registradas não podem ser apagados.',
                      destructive: true,
                      onConfirm: () => run('delete'),
                    })
                  }
                  style={({ pressed }) => [
                    editorStyles.iconButton,
                    pressed && editorStyles.iconPressed,
                  ]}
                >
                  <Icon name="trash" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  );
}

/**
 * One published/draft item as the patient will see it (snapshot): pt-BR name
 * when translated, its library reference, image and prescribed values.
 */
function ReviewItem({ item }: { item: WorkoutItem }) {
  const localized = exerciseLocalization(item.exercise_snapshot);
  const originalName = item.exercise_snapshot.name;
  return (
    <Card white title={exerciseName(item)}>
      {localized && typeof originalName === 'string' ? (
        <Body>{`Nome da biblioteca: ${originalName}`}</Body>
      ) : null}
      <ExerciseImageGallery
        limit={1}
        images={exerciseImages(item.exercise_snapshot)}
        exerciseName={exerciseName(item)}
        showAttribution={false}
      />
      <Body>{prescriptionText(item, prescribedSideLabels)}</Body>
      <Body>{restText(item)}</Body>
      {item.counting_rule ? (
        <>
          <Body>{`${automaticCountingLabel}: ativada.`}</Body>
          <Badge label={automaticCountingNotice} tone="warning" />
        </>
      ) : null}
      {item.professional_guidance ? (
        <Body>{item.professional_guidance}</Body>
      ) : null}
    </Card>
  );
}

const editorStyles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseTitle: {
    ...typography.title,
    fontFamily: fonts.bold,
    color: colors.text,
    flex: 1,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  reviewActions: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    minWidth: layout.compactControlHeight,
    minHeight: layout.compactControlHeight,
    borderRadius: layout.compactControlHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: { backgroundColor: colors.surfaceMuted },
  seriesRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  seriesField: { flex: 1 },
  stepper: {
    ...typography.heading,
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  caption: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  detailsButton: {
    minHeight: layout.compactControlHeight,
    justifyContent: 'center',
  },
  detailsText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
