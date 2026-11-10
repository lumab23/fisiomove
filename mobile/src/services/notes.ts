import type { ApiClient } from '../api/ApiClient';
import { queryString } from '../api/query';
import type { PageParams, UUID } from '../contracts/common';
import type {
  Note,
  NotePage,
  NoteVisibility,
  OwnNotePage,
} from '../contracts/domain';

export interface NoteWrite {
  content: string;
  visibility: NoteVisibility;
}

export class NoteService {
  constructor(private readonly api: ApiClient) {}

  list(patientId: UUID, params: PageParams = {}): Promise<NotePage> {
    return this.api.get(`/patients/${patientId}/notes${queryString(params)}`);
  }

  /** `GET /me/notes` (patient): own notes marked visible, newest first. */
  mine(params: PageParams = {}): Promise<OwnNotePage> {
    return this.api.get(`/me/notes${queryString(params)}`);
  }

  create(patientId: UUID, payload: NoteWrite): Promise<Note> {
    return this.api.post(`/patients/${patientId}/notes`, payload);
  }

  update(noteId: UUID, payload: Partial<NoteWrite>): Promise<Note> {
    return this.api.patch(`/notes/${noteId}`, payload);
  }
}
