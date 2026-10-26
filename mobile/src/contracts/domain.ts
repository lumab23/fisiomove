import type { ISODateTime, JsonValue, Page, PageParams, UUID } from './common';

export type Side = 'left' | 'right' | 'bilateral';
export type WorkoutStatus = 'draft' | 'published' | 'archived';
export type SessionStatus = 'completed' | 'interrupted';
export type NoteVisibility = 'patient_visible' | 'professional_only';

export interface Exercise {
  id: UUID;
  code: string;
  name: string;
  instructions: string;
  allowed_sides: Side[];
  rule_version: string;
  supported_parameters: Record<string, JsonValue>;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'revoked';
  approved_rule_version: string | null;
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

export interface Achievement {
  id: UUID;
  patient_id: UUID;
  session_result_id: UUID;
  code: string;
  achieved_at: ISODateTime;
}
