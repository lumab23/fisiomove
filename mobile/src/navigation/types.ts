import type { UUID } from '../contracts/common';

export type AuthStackParamList = {
  Welcome: undefined;
  FirstAccess: undefined;
  Login: undefined;
  ChangePassword: undefined;
};

export type PatientStackParamList = {
  PatientHome: undefined;
  PatientWorkout: { workoutId?: UUID } | undefined;
  PatientPreparation: { workoutId: UUID; workoutRevisionId: UUID };
  /** The workout and its revision come from the local draft. */
  PatientExercise: { clientSessionId: UUID };
  PatientCompletion: { clientSessionId: UUID };
  PatientProgress: undefined;
};

export type PhysiotherapistStackParamList = {
  PatientList: undefined;
  PatientCreate: undefined;
  PatientDetails: { patientId: UUID };
  WorkoutConfiguration: { patientId: UUID; workoutId?: UUID };
  PatientMonitoring: { patientId: UUID };
};
