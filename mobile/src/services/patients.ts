import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type { PageParams, UUID } from '../contracts/common';
import type {
  Patient,
  PatientAccessResult,
  PatientCreate,
  PatientPage,
  PatientUpdate,
} from '../contracts/domain';

export class PatientService {
  constructor(private readonly api: ApiClient) {}

  list(params: PageParams = {}): Promise<PatientPage> {
    return this.api.get(`/patients${queryString(params)}`);
  }

  get(patientId: UUID): Promise<Patient> {
    return this.api.get(`/patients/${patientId}`);
  }

  create(payload: PatientCreate): Promise<Patient> {
    return this.api.post('/patients', payload);
  }

  update(patientId: UUID, payload: PatientUpdate): Promise<Patient> {
    return this.api.patch(`/patients/${patientId}`, payload);
  }

  activateAccess(patientId: UUID): Promise<PatientAccessResult> {
    return this.api.post(`/patients/${patientId}/access`, {
      operation: 'activate',
    });
  }

  resetTemporaryPassword(patientId: UUID): Promise<PatientAccessResult> {
    return this.api.post(`/patients/${patientId}/access`, {
      operation: 'reset_temporary_password',
    });
  }
}
