import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { appDependencies } from '../../app/dependencies';
import { ExerciseImageGallery } from '../../components/ExerciseImageGallery';
import { FormField } from '../../components/FormField';
import { Screen } from '../../components/Screen';
import { useScreenMessage } from '../../components/ScreenMessage';
import type { UUID } from '../../contracts/common';
import type {
  Exercise,
  ExerciseLocalizationUpdate,
} from '../../contracts/domain';
import { useCatalogExercise } from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { colors, fonts, spacing, typography } from '../../theme/theme';
import { Badge, Body, Button, Card } from '../../ui';
import {
  attributionText,
  exerciseImages,
  exerciseLocalization,
  originalLanguageSeal,
} from '../patient/workoutText';
import { apiErrorMessage, ResourceView } from './shared';

/**
 * pt-BR name and steps written by the physiotherapist (DEC-011). The original
 * English text is never edited; the translation is optional and the patient
 * sees it only after the workout items are saved again and published (Q-P6).
 */
export const republishNotice =
  'Para o paciente ver a tradução e as imagens, salve o treino de novo e publique.';

/** Limits of `ExerciseLocalizationUpdate` (API contract, not clinical). */
const limits = { name: 200, steps: 50, step: 2000 } as const;

export type TranslationDraft = { name: string; steps: string };
export type TranslationErrors = Partial<Record<'name' | 'steps', string>>;

export const emptyTranslation: TranslationDraft = { name: '', steps: '' };

/** A leading "1." or "1)" typed or pasted by the user; the API numbers steps. */
const stepNumber = /^\d+\s*[.)]\s*/;

/** One step per non-empty line, without the numbering. */
export function stepsFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim().replace(stepNumber, '').trim())
    .filter(Boolean);
}

/** Stored "1. a\n2. b" → editable "a\nb". */
export function textFromSteps(instructions: string) {
  return stepsFromText(instructions).join('\n');
}

/**
 * Validates the form. With `required` false (adding to the catalog) both
 * fields may be empty, which means "no translation"; one alone is an error.
 */
export function buildTranslation(
  draft: TranslationDraft,
  required: boolean,
):
  | { translation: ExerciseLocalizationUpdate | null }
  | { errors: TranslationErrors } {
  const name = draft.name.trim();
  const steps = stepsFromText(draft.steps);
  if (!required && !name && !steps.length) {
    return { translation: null };
  }
  const errors: TranslationErrors = {};
  if (!name) {
    errors.name = required
      ? 'Escreva o nome em português.'
      : 'Escreva também o nome em português, ou deixe os dois campos vazios.';
  } else if (name.length > limits.name) {
    errors.name = 'O nome pode ter no máximo 200 caracteres.';
  }
  if (!steps.length) {
    errors.steps = required
      ? 'Escreva pelo menos um passo em português.'
      : 'Escreva também os passos em português, ou deixe os dois campos vazios.';
  } else if (steps.length > limits.steps) {
    errors.steps = 'Use no máximo 50 passos (um por linha).';
  } else if (steps.some(step => step.length > limits.step)) {
    errors.steps = 'Cada passo pode ter no máximo 2000 caracteres.';
  }
  return Object.keys(errors).length
    ? { errors }
    : { translation: { name, instructions: steps } };
}

/** Name and steps fields; the original stays visible next to them. */
export function TranslationFields({
  draft,
  errors,
  onChange,
  optional,
}: {
  draft: TranslationDraft;
  errors: TranslationErrors;
  onChange: (draft: TranslationDraft) => void;
  optional: boolean;
}) {
  const suffix = optional ? ' (opcional)' : '';
  return (
    <>
      <FormField
        label={`Nome em português${suffix}`}
        value={draft.name}
        onChangeText={name => onChange({ ...draft, name })}
        maxLength={limits.name}
        error={errors.name}
      />
      <FormField
        label={`Passos em português${suffix}`}
        hint="Escreva um passo por linha, na mesma ordem do original. A numeração é feita automaticamente."
        value={draft.steps}
        onChangeText={steps => onChange({ ...draft, steps })}
        multiline
        error={errors.steps}
      />
    </>
  );
}

/** Original name and steps (English), read with the English voice. */
export function OriginalExerciseText({
  name,
  instructions,
}: {
  name: string;
  instructions: string;
}) {
  return (
    <Card white title="Texto de referência">
      <Badge label={originalLanguageSeal} />
      <Text accessibilityLanguage="en" style={t.name}>
        {name}
      </Text>
      <Text accessibilityLanguage="en" style={t.body}>
        {instructions}
      </Text>
    </Card>
  );
}

/**
 * Catalog exercise as the physiotherapist sees it in the workout editor:
 * first image (API), pt-BR text when it exists, the original and the source.
 */
export function CatalogExerciseText({
  exercise,
  onEditTranslation,
}: {
  exercise: Exercise;
  onEditTranslation?: () => void;
}) {
  const localization = exerciseLocalization(exercise);
  const source = exercise.source;
  const displayName = localization?.name ?? exercise.name;
  return (
    <View style={t.block}>
      <ExerciseImageGallery
        limit={1}
        images={exerciseImages(exercise)}
        exerciseName={displayName}
      />
      {localization ? (
        <>
          <Text style={t.label}>Em português (o paciente vê este texto)</Text>
          <Text style={t.name}>{localization.name}</Text>
          <Text style={t.body}>{localization.instructions}</Text>
        </>
      ) : null}
      {source ? (
        <>
          <Text style={t.label}>
            {localization
              ? 'Referência da fonte'
              : 'Tradução em português pendente'}
          </Text>
          {localization ? (
            <Text accessibilityLanguage="en" style={t.name}>
              {exercise.name}
            </Text>
          ) : null}
          <Text accessibilityLanguage="en" style={t.body}>
            {exercise.instructions}
          </Text>
          <Text style={t.caption}>{attributionText(source, localization)}</Text>
          {onEditTranslation ? (
            <Button
              secondary
              compact
              label={
                localization
                  ? 'Editar tradução em português'
                  : 'Escrever tradução em português'
              }
              onPress={onEditTranslation}
            />
          ) : null}
        </>
      ) : (
        <Text style={t.body}>{exercise.instructions}</Text>
      )}
    </View>
  );
}

export function CatalogExerciseTranslationScreen() {
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'CatalogExerciseTranslation'>>();
  const exercise = useCatalogExercise(params.exerciseId);
  return exercise.state.status === 'success' ? (
    <TranslationForm exercise={exercise.state.data} />
  ) : (
    <Screen professional back="Exercício" title="Tradução para o português">
      <ResourceView resource={exercise} loadingLabel="Carregando o exercício">
        {() => null}
      </ResourceView>
    </Screen>
  );
}

const translationErrors: Record<string, string> = {
  exercise_not_found:
    'Este exercício não está mais no catálogo. A tradução não foi salva.',
};

function TranslationForm({ exercise }: { exercise: Exercise }) {
  const navigation = useFrontendNavigation();
  const { show } = useScreenMessage();
  const current = exerciseLocalization(exercise);
  const [draft, setDraft] = useState<TranslationDraft>(() =>
    current
      ? { name: current.name, steps: textFromSteps(current.instructions) }
      : emptyTranslation,
  );
  const [errors, setErrors] = useState<TranslationErrors>({});
  const [saving, setSaving] = useState(false);
  const save = async (id: UUID) => {
    if (saving) {
      return;
    }
    const built = buildTranslation(draft, false);
    if ('errors' in built) {
      setErrors(built.errors);
      return;
    }
    if (!built.translation) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      await appDependencies.exercises.updateLocalization(id, built.translation);
      show(`Tradução salva. ${republishNotice}`, 'success');
      navigation.goBack();
    } catch (cause) {
      show(apiErrorMessage(cause, translationErrors), 'error');
      setSaving(false);
    }
  };
  return (
    <Screen
      professional
      back="Exercício"
      title="Tradução para o português"
      footer={
        <Button
          label={saving ? 'Salvando…' : 'Salvar tradução'}
          disabled={saving}
          onPress={() => save(exercise.id)}
        />
      }
    >
      <Body>
        O conteúdo de referência continua preservado e a origem da tradução é
        registrada. A tradução vale para este exercício em todo o catálogo.
      </Body>
      <Body>{republishNotice}</Body>
      {current ? (
        <Body>{`Tradução atual feita por ${current.translated_by_name}.`}</Body>
      ) : null}
      <OriginalExerciseText
        name={exercise.name}
        instructions={exercise.instructions}
      />
      <TranslationFields
        draft={draft}
        errors={errors}
        optional
        onChange={value => {
          setDraft(value);
          setErrors({});
        }}
      />
    </Screen>
  );
}

const t = StyleSheet.create({
  block: { gap: spacing.sm },
  label: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  name: {
    color: colors.text,
    ...typography.body,
    fontFamily: fonts.bold,
  },
  body: {
    color: colors.textMuted,
    ...typography.body,
    fontFamily: fonts.regular,
  },
  caption: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.regular,
  },
});
