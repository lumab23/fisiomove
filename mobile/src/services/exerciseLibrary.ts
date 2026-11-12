import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type {
  CatalogImportRequest,
  Exercise,
  ExerciseLocalizationUpdate,
  LibraryExerciseDetail,
  LibraryExercisePage,
  LibrarySearchParams,
  Side,
} from '../contracts/domain';

/**
 * External reference library (physiotherapist only). Reading never changes
 * anything; only `addToCatalog`, an explicit choice of the physiotherapist,
 * creates a catalog exercise (DEC-006).
 */
export class ExerciseLibraryService {
  constructor(private readonly api: ApiClient) {}

  search(params: LibrarySearchParams = {}): Promise<LibraryExercisePage> {
    const query = params.query?.trim() || undefined;
    const body_part = params.body_part?.trim() || undefined;
    return this.api.get(
      `/exercise-library${queryString({ ...params, query, body_part })}`,
    );
  }

  get(externalId: string): Promise<LibraryExerciseDetail> {
    return this.api.get(`/exercise-library/${encodeURIComponent(externalId)}`);
  }

  /**
   * Adds the item to the catalog with the sides chosen by the
   * physiotherapist and, optionally, the pt-BR text (both fields or none).
   * 201 when added now, 200 when it was already there (text ignored).
   */
  addToCatalog(
    externalId: string,
    allowedSides: Side[],
    translation?: ExerciseLocalizationUpdate,
  ): Promise<Exercise> {
    const body: CatalogImportRequest = { allowed_sides: allowedSides };
    if (translation) {
      body.name_pt_br = translation.name;
      body.instructions_pt_br = translation.instructions;
    }
    return this.api.post(
      `/exercise-library/${encodeURIComponent(externalId)}/catalog`,
      body,
    );
  }
}
