import type { SecureJsonStorage } from '../../storage/secureJsonStorage';
import type {
  CalibrationContext,
  MovementCalibration,
} from './types';
import { calibrationMatches } from './calibration';

export class CalibrationStore {
  constructor(private readonly storage: SecureJsonStorage) {}

  async get(
    context: CalibrationContext,
  ): Promise<MovementCalibration | null> {
    const value = await this.storage.get<MovementCalibration>(serviceKey(context));
    return value && calibrationMatches(value, context) ? value : null;
  }

  set(value: MovementCalibration): Promise<void> {
    return this.storage.set(serviceKey(value), value);
  }

  remove(context: CalibrationContext): Promise<void> {
    return this.storage.remove(serviceKey(context));
  }
}

function serviceKey(context: CalibrationContext): string {
  return [
    'fisiomove.calibration.v1',
    context.owner_user_id,
    context.exercise_id,
    context.workout_id,
    context.workout_revision_id,
    context.workout_item_id,
    context.rule_version,
  ].join(':');
}
