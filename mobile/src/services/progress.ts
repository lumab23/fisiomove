import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type { ISODateTime, UUID } from '../contracts/common';
import type { Achievement, ProgressSummary } from '../contracts/domain';

export interface ProgressPeriod {
  period_start: ISODateTime;
  period_end: ISODateTime;
}

export class ProgressService {
  constructor(private readonly api: ApiClient) {}

  mine(period: ProgressPeriod): Promise<ProgressSummary> {
    return this.api.get(`/me/progress${queryString(period)}`);
  }

  forPatient(
    patientId: UUID,
    period: ProgressPeriod,
  ): Promise<ProgressSummary> {
    return this.api.get(
      `/patients/${patientId}/progress${queryString(period)}`,
    );
  }

  myAchievements(): Promise<Achievement[]> {
    return this.api.get('/me/achievements');
  }

  patientAchievements(patientId: UUID): Promise<Achievement[]> {
    return this.api.get(`/patients/${patientId}/achievements`);
  }
}
