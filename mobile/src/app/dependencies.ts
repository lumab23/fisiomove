import { ApiClient } from '../api/ApiClient';
import { AuthService } from '../auth/AuthService';
import { AuthenticationSession } from '../auth/AuthenticationSession';
import { appConfig } from '../config/environment';
import { ExerciseService } from '../services/exercises';
import { NoteService } from '../services/notes';
import { PatientService } from '../services/patients';
import { ProgressService } from '../services/progress';
import { SessionService } from '../services/sessions';
import { WorkoutService } from '../services/workouts';
import { keychainJsonStorage } from '../storage/secureJsonStorage';
import { SessionSyncService } from '../sync/SessionSyncService';
import { SessionSyncStore } from '../sync/SessionSyncStore';

const authenticationSession = new AuthenticationSession(
  appConfig,
  keychainJsonStorage,
);
const api = new ApiClient(appConfig, authenticationSession);
const sessions = new SessionService(api);

export const appDependencies = {
  config: appConfig,
  authenticationSession,
  api,
  auth: new AuthService(api, authenticationSession),
  exercises: new ExerciseService(api),
  workouts: new WorkoutService(api),
  patients: new PatientService(api),
  notes: new NoteService(api),
  sessions,
  progress: new ProgressService(api),
  sessionSync: new SessionSyncService(
    sessions,
    new SessionSyncStore(keychainJsonStorage),
  ),
};

export type AppDependencies = typeof appDependencies;
