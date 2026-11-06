import type { JsonValue } from '../../contracts/common';
import type {
  ExerciseImage,
  ExerciseLocalization,
  Side,
  WorkoutItem,
} from '../../contracts/domain';

export const sideLabels: Record<Side, string> = {
  left: 'Lado esquerdo',
  right: 'Lado direito',
  bilateral: 'Os dois lados',
};

type Snapshot = Pick<WorkoutItem, 'exercise_snapshot'>;

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * pt-BR text of an exercise (DEC-011) from a snapshot or an `Exercise`;
 * `null` without translation and for snapshots published before it existed.
 */
export function exerciseLocalization(
  exercise: { localization?: unknown } | Record<string, JsonValue>,
): ExerciseLocalization | null {
  const value = exercise.localization;
  if (
    !isRecord(value) ||
    !filled(value.name) ||
    !filled(value.instructions) ||
    typeof value.translated_by_name !== 'string' ||
    typeof value.translated_at !== 'string'
  ) {
    return null;
  }
  return {
    language: 'pt-BR',
    name: value.name,
    instructions: value.instructions,
    translated_by_name: value.translated_by_name,
    translated_at: value.translated_at,
  };
}

/** Images served by the API (DEC-010), ordered; empty for old snapshots. */
export function exerciseImages(
  exercise: { images?: unknown } | Record<string, JsonValue>,
): ExerciseImage[] {
  const value = exercise.images;
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (image): image is { position: number; url: string } =>
        isRecord(image) &&
        typeof image.position === 'number' &&
        typeof image.url === 'string',
    )
    .map(({ position, url }) => ({ position, url }))
    .sort((a, b) => a.position - b.position);
}

/** True when the snapshot came from the reference library (DEC-006). */
function hasLibrarySource(snapshot: Record<string, JsonValue>) {
  return isRecord(snapshot.source);
}

/**
 * Name, steps and language of what the patient reads: the pt-BR text when it
 * exists; otherwise the original. `original` is true only for library text
 * kept in English, which gets the seal and `accessibilityLanguage="en"`.
 */
export function exerciseText(item: Snapshot): {
  name: string;
  steps: string | null;
  original: boolean;
} {
  const snapshot = item.exercise_snapshot;
  const localization = exerciseLocalization(snapshot);
  if (localization) {
    return {
      name: localization.name,
      steps: localization.instructions,
      original: false,
    };
  }
  return {
    name: filled(snapshot.name) ? snapshot.name : 'Exercício',
    steps: filled(snapshot.instructions) ? snapshot.instructions : null,
    original: hasLibrarySource(snapshot),
  };
}

/** Seal for library text shown in the original language (KI-012). */
export const originalLanguageSeal = 'Texto original em inglês';

/** Name of the published snapshot, in pt-BR when translated. */
export function exerciseName(item: Snapshot) {
  return exerciseText(item).name;
}

/** `accessibilityLanguage` for a text that may be the English original. */
export function textLanguage(original: boolean) {
  return original ? 'en' : undefined;
}

/** "AAAA-MM-DD..." → "DD/MM/AAAA" (UTC date, as in the source attribution). */
function dateBr(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return day && month && year ? `${day}/${month}/${year}` : iso;
}

/**
 * Portuguese equivalent of `source.attribution`, with the change required by
 * CC BY-NC when the text was translated (DEC-011).
 */
export function attributionText(
  source: { source: string; license: string },
  localization: ExerciseLocalization | null,
) {
  if (!localization) {
    return sourceLabel(source);
  }
  return `Adaptado de ${shortSourceName(source)} (${source.license}). Nome e passos traduzidos para o português por ${localization.translated_by_name} em ${dateBr(localization.translated_at)}; o original em inglês foi preservado.`;
}

/** Short attribution, e.g. "Fonte: OpenExerciseBase (CC BY-NC 4.0)". */
export function sourceLabel(source: { source: string; license: string }) {
  return `Fonte: ${shortSourceName(source)} (${source.license})`;
}

/** Drops the institution in parentheses to keep the line short. */
function shortSourceName(source: { source: string }) {
  return source.source.split(' (')[0].trim() || source.source;
}

/**
 * Attribution of an exercise added from the reference library
 * (`exercise_snapshot.source`, DEC-006). `null` for catalog exercises without
 * provenance and for snapshots published before the field existed.
 */
export function exerciseSourceText(item: Snapshot) {
  const source = item.exercise_snapshot.source;
  if (!isRecord(source)) {
    return null;
  }
  const { source: name, license } = source;
  return typeof name === 'string' && typeof license === 'string'
    ? attributionText(
        { source: name, license },
        exerciseLocalization(item.exercise_snapshot),
      )
    : null;
}

/** Prescribed values exactly as published by the physiotherapist. */
export function prescriptionText(item: WorkoutItem) {
  const sets = `${item.sets} ${item.sets === 1 ? 'série' : 'séries'}`;
  const repetitions = `${item.repetitions} ${
    item.repetitions === 1 ? 'repetição' : 'repetições'
  }`;
  return `${sets} · ${repetitions} · ${sideLabels[item.side]}`;
}
