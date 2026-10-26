import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type { PageParams, UUID } from '../contracts/common';
import type { Exercise, ExercisePage } from '../contracts/domain';

export class ExerciseService {
  constructor(private readonly api: ApiClient) {}

  list(params: PageParams = {}): Promise<ExercisePage> {
    return this.api.get(`/exercises${queryString(params)}`);
  }

  get(exerciseId: UUID): Promise<Exercise> {
    return this.api.get(`/exercises/${exerciseId}`);
  }
}
