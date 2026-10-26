import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type { UUID } from '../contracts/common';
import type {
  SessionListParams,
  SessionPage,
  SessionResult,
  SessionResultInput,
} from '../contracts/domain';

export class SessionService {
  constructor(private readonly api: ApiClient) {}

  create(payload: SessionResultInput): Promise<SessionResult> {
    return this.api.post('/me/sessions', payload);
  }

  listMine(params: SessionListParams = {}): Promise<SessionPage> {
    return this.api.get(`/me/sessions${queryString(params)}`);
  }

  getMine(sessionId: UUID): Promise<SessionResult> {
    return this.api.get(`/me/sessions/${sessionId}`);
  }

  listForPatient(
    patientId: UUID,
    params: SessionListParams = {},
  ): Promise<SessionPage> {
    return this.api.get(
      `/patients/${patientId}/sessions${queryString(params)}`,
    );
  }

  getForPatient(patientId: UUID, sessionId: UUID): Promise<SessionResult> {
    return this.api.get(`/patients/${patientId}/sessions/${sessionId}`);
  }
}
