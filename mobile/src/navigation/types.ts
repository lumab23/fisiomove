import type { UUID } from '../contracts/common';

export type AuthStackParamList = {
  Login: undefined;
  ChangePassword: undefined;
};

export type PatientStackParamList = {
  PatientHome: undefined;
  PatientWorkout: { workoutId?: UUID } | undefined;
  PatientPreparation: { workoutId: UUID; workoutRevisionId: UUID };
  PatientExercise: {
    workoutId: UUID;
    workoutRevisionId: UUID;
    clientSessionId: UUID;
  };
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
