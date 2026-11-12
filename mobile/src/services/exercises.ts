import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type { PageParams, UUID } from '../contracts/common';
import type {
  Exercise,
  ExerciseLocalizationUpdate,
  ExercisePage,
} from '../contracts/domain';

export class ExerciseService {
  constructor(private readonly api: ApiClient) {}

  list(params: PageParams = {}): Promise<ExercisePage> {
    return this.api.get(`/exercises${queryString(params)}`);
  }

  get(exerciseId: UUID): Promise<Exercise> {
    return this.api.get(`/exercises/${exerciseId}`);
  }

  /**
   * Creates or replaces the pt-BR text (physiotherapist, DEC-011). Published
   * workouts keep their snapshot until the items are saved and published again.
   */
  updateLocalization(
    exerciseId: UUID,
    payload: ExerciseLocalizationUpdate,
  ): Promise<Exercise> {
    return this.api.put(`/exercises/${exerciseId}/localization`, payload);
  }
}
