import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type { PageParams, UUID } from '../contracts/common';
import type { Workout, WorkoutPage, WorkoutWrite } from '../contracts/domain';

export type WorkoutUpdate = Partial<WorkoutWrite>;

export class WorkoutService {
  constructor(private readonly api: ApiClient) {}

  listMine(params: PageParams = {}): Promise<WorkoutPage> {
    return this.api.get(`/me/workouts${queryString(params)}`);
  }

  get(workoutId: UUID): Promise<Workout> {
    return this.api.get(`/workouts/${workoutId}`);
  }

  listForPatient(
    patientId: UUID,
    params: PageParams = {},
  ): Promise<WorkoutPage> {
    return this.api.get(
      `/patients/${patientId}/workouts${queryString(params)}`,
    );
  }

  create(patientId: UUID, payload: WorkoutWrite): Promise<Workout> {
    return this.api.post(`/patients/${patientId}/workouts`, payload);
  }

  update(workoutId: UUID, payload: WorkoutUpdate): Promise<Workout> {
    return this.api.patch(`/workouts/${workoutId}`, payload);
  }

  publish(workoutId: UUID): Promise<Workout> {
    return this.api.post(`/workouts/${workoutId}/publish`);
  }

  archive(workoutId: UUID): Promise<Workout> {
    return this.api.post(`/workouts/${workoutId}/archive`);
  }
}
