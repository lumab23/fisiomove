import type { ApiClient } from '../api/ApiClient';
import type {
  LinkedPhysiotherapist,
  PatientSelfProfile,
  PhysiotherapistProfile,
  PhysiotherapistProfileUpdate,
} from '../contracts/domain';

export class ProfileService {
  constructor(private readonly api: ApiClient) {}

  /** `GET /me/profile`: name of the authenticated patient only. */
  mine(): Promise<PatientSelfProfile> {
    return this.api.get('/me/profile');
  }

  /**
   * `GET /me/physiotherapist` (patient): name of the linked professional.
   * Rejects with `not_found`/`physiotherapist_not_found` without a link.
   */
  linkedPhysiotherapist(): Promise<LinkedPhysiotherapist> {
    return this.api.get('/me/physiotherapist');
  }

  /** `GET /me/physiotherapist-profile` (physiotherapist). */
  physiotherapistProfile(): Promise<PhysiotherapistProfile> {
    return this.api.get('/me/physiotherapist-profile');
  }

  /** `PUT /me/physiotherapist-profile`: creates or replaces the own name. */
  updatePhysiotherapistProfile(
    payload: PhysiotherapistProfileUpdate,
  ): Promise<PhysiotherapistProfile> {
    return this.api.put('/me/physiotherapist-profile', payload);
  }
}
