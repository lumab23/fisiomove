import type { ISODateTime, JsonValue, Page, PageParams, UUID } from './common';

export type Side = 'left' | 'right' | 'bilateral';
export type WorkoutStatus = 'draft' | 'published' | 'archived';
export type SessionStatus = 'completed' | 'interrupted';
export type NoteVisibility = 'patient_visible' | 'professional_only';

/**
 * Attribution of a catalog exercise added from the reference library
 * (DEC-006). `null` for exercises created in FisioMove.
 */
export interface ExerciseSource {
  source: string;
  external_id: string;
  source_url: string;
  license: string;
  license_url: string | null;
  attribution: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'revoked';

/**
 * Image copied from the reference library (DEC-010). `url` is relative to the
 * server root (`/api/v1/exercises/{id}/images/{position}`) and needs the same
 * `Authorization` header as the other routes.
 */
export interface ExerciseImage {
  position: number;
  url: string;
}

/**
 * pt-BR name and steps written by a physiotherapist (DEC-011). `instructions`
 * uses the original format (`"1. ...\n2. ..."`). `null` without translation.
 */
export interface ExerciseLocalization {
  language: 'pt-BR';
  name: string;
  instructions: string;
  translated_by_name: string;
  translated_at: ISODateTime;
}

export interface Exercise {
  id: UUID;
  code: string;
  name: string;
  instructions: string;
  allowed_sides: Side[];
  rule_version: string;
  supported_parameters: Record<string, JsonValue>;
  is_active: boolean;
  approval_status: ApprovalStatus;
  approved_rule_version: string | null;
  source?: ExerciseSource | null;
  /** Absent in responses (and snapshots) older than DEC-010. */
  images?: ExerciseImage[];
  /** Absent in responses (and snapshots) older than DEC-011. */
  localization?: ExerciseLocalization | null;
}

/** Body of `PUT /exercises/{id}/localization`: one line per step. */
export interface ExerciseLocalizationUpdate {
  name: string;
  instructions: string[];
}

export type ExercisePage = Page<Exercise>;

export interface WorkoutItemInput {
  position: number;
  exercise_id: UUID;
  side: Side;
  sets: number;
  repetitions: number;
  rest_duration_ms: number;
  professional_guidance?: string | null;
  parameters?: Record<string, JsonValue>;
}

export interface WorkoutItem extends Omit<
  WorkoutItemInput,
  'professional_guidance' | 'parameters'
> {
  id: UUID;
  rule_version: string;
  professional_guidance: string | null;
  parameters: Record<string, JsonValue>;
  exercise_snapshot: Record<string, JsonValue>;
}

export interface Workout {
  id: UUID;
  patient_id: UUID;
  created_by: UUID;
  status: WorkoutStatus;
  current_revision_id: UUID;
  revision_number: number;
  instructions: string | null;
  published_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  items: WorkoutItem[];
}

export interface WorkoutWrite {
  instructions?: string | null;
  items: WorkoutItemInput[];
}

export type WorkoutPage = Page<Workout>;

export interface Patient {
  id: UUID;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  has_access: boolean;
  access_is_active: boolean;
  must_change_password: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PatientCreate {
  full_name: string;
  email?: string | null;
  phone?: string | null;
}

export interface PatientUpdate {
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
}

export interface PatientAccessResult {
  patient_id: UUID;
  user_id: UUID;
  email: string;
  temporary_password: string;
  must_change_password: true;
  action: string;
}

export type PatientPage = Page<Patient>;

/** `GET /me/profile` (B03): the authenticated patient's own name. */
export interface PatientSelfProfile {
  full_name: string;
}

/**
 * `GET /me/physiotherapist` (patient): only the linked professional's name,
 * `null` until they define it. 404 `physiotherapist_not_found` without a link.
 */
export interface LinkedPhysiotherapist {
  full_name: string | null;
}

/** `GET`/`PUT /me/physiotherapist-profile` (physiotherapist). */
export interface PhysiotherapistProfile {
  full_name: string | null;
}

/** Name with 2–200 characters after trimming (`422` otherwise). */
export interface PhysiotherapistProfileUpdate {
  full_name: string;
}

export interface Note {
  id: UUID;
  patient_id: UUID;
  author_id: UUID;
  content: string;
  visibility: NoteVisibility;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type NotePage = Page<Note>;

export interface SessionItemResultInput {
  workout_item_id: UUID;
  position: number;
  completed_sets: number;
  completed_repetitions: number;
  active_duration_ms: number;
  interrupted: boolean;
}

export interface SessionResultInput {
  client_session_id: UUID;
  workout_id: UUID;
  workout_revision_id: UUID;
  status: SessionStatus;
  started_at: ISODateTime;
  finished_at: ISODateTime;
  active_duration_ms: number;
  low_confidence_summary: Record<string, JsonValue> | null;
  feedback_summary: Record<string, JsonValue> | null;
  items: SessionItemResultInput[];
}

export interface SessionResult extends SessionResultInput {
  id: UUID;
  patient_id: UUID;
  completed_repetitions: number;
  score: number;
  workout_snapshot: Record<string, JsonValue>;
  created_at: ISODateTime;
}

export interface SessionSummary {
  id: UUID;
  patient_id: UUID;
  workout_id: UUID;
  workout_revision_id: UUID;
  status: SessionStatus;
  started_at: ISODateTime;
  finished_at: ISODateTime;
  active_duration_ms: number;
  prescribed_repetitions: number;
  performed_repetitions: number;
  score: number;
}

export interface SessionListParams extends PageParams {
  period_start?: ISODateTime;
  period_end?: ISODateTime;
}

export type SessionPage = Page<SessionSummary>;

export interface ProgressSummary {
  patient_id: UUID;
  period_start: ISODateTime;
  period_end: ISODateTime;
  completed_sessions: number;
  interrupted_sessions: number;
  active_duration_ms: number;
  prescribed_repetitions: number;
  performed_repetitions: number;
  score: number;
  generated_at: ISODateTime;
}

/**
 * External reference library (`/exercise-library`, physiotherapist only).
 * Reference material; the physiotherapist may add an item to the catalog
 * (`POST /exercise-library/{external_id}/catalog`, DEC-006). Prescription
 * values never come from the library.
 */
export interface LibraryAttribution {
  source: string;
  license: string;
  license_url: string;
  source_url: string;
  changes: string;
}

export interface LibraryExerciseSummary {
  external_id: string;
  name: string;
  categories: string[];
  body_parts: string[];
  equipment: string[];
  image_url: string | null;
  review_status: string | null;
}

export interface LibraryExercisePage extends Page<LibraryExerciseSummary> {
  usage_notice: string;
  attribution: LibraryAttribution;
}

export interface LibraryInstructionStep {
  step_number: number;
  description: string;
}

export interface LibraryExerciseDetail extends Omit<
  LibraryExerciseSummary,
  'image_url'
> {
  instructions: LibraryInstructionStep[];
  instructions_language: string;
  image_urls: string[];
  created_by: string | null;
  usage_notice: string;
  attribution: LibraryAttribution;
  /** Catalog exercise created from this item; `null` until it is added. */
  catalog_exercise: CatalogExerciseStatus | null;
}

export interface CatalogExerciseStatus {
  exercise_id: UUID;
  approval_status: ApprovalStatus;
  /** True when the current approval was recorded by the signed-in user. */
  added_by_me: boolean;
}

/**
 * Body of `POST /exercise-library/{external_id}/catalog`: 1–3 unique sides
 * and, optionally, the pt-BR name and steps (both or neither, DEC-011).
 */
export interface CatalogImportRequest {
  allowed_sides: Side[];
  name_pt_br?: string;
  instructions_pt_br?: string[];
}

export interface LibrarySearchParams extends PageParams {
  query?: string;
  body_part?: string;
}
