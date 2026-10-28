import type { PoseFrame } from '../vision/types';
import { assessSelectedArm } from '../vision/poseAssessment';
import type {
  ApprovedMovementRule,
  MovementEngineOptions,
  MovementPhase,
  MovementUpdate,
} from './types';
import { measureJointAngle } from './geometry';

export class MovementEngine {
  private phase: MovementPhase = 'awaiting_initial';
  private repetitions = 0;
  private movementStartedAt: number | null = null;
  private lastTimestamp: number | null = null;
  private lastAngle: number | null = null;
  private paused = false;
  private readonly recentAngles: number[] = [];

  constructor(
    private readonly rule: ApprovedMovementRule,
    private readonly options: MovementEngineOptions,
  ) {
    if (
      rule.approval_status !== 'approved' ||
      rule.rule_version !== rule.approved_rule_version
    ) {
      throw new Error('A regra do exercício não possui aprovação compatível.');
    }
    validateRule(rule);
    if (
      !Number.isInteger(options.smoothing_window_size) ||
      options.smoothing_window_size <= 0
    ) {
      throw new Error('A janela de suavização precisa ser informada e válida.');
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.resetCycle();
    }
  }

  reset(): void {
    this.repetitions = 0;
    this.paused = false;
    this.resetCycle();
  }

  update(frame: PoseFrame, side: 'left' | 'right'): MovementUpdate {
    if (this.paused) {
      return this.result('paused', null);
    }
    if (!Number.isFinite(frame.timestamp_ms)) {
      this.resetCycle();
      return this.result('capture_adjustment', null);
    }
    if (
      this.lastTimestamp !== null &&
      frame.timestamp_ms - this.lastTimestamp >
        this.rule.phases.maximum_frame_gap_ms
    ) {
      this.resetCycle();
    }

    const arm = assessSelectedArm(frame, side, this.rule.confidence);
    if (arm.status !== 'ready') {
      this.resetCycle();
      return this.result(arm.status, null);
    }
    const measurement = measureJointAngle(frame, this.rule);
    if (measurement.status === 'capture_adjustment') {
      this.resetCycle();
      return this.result('capture_adjustment', null);
    }
    if (measurement.status === 'degenerate_geometry') {
      this.resetCycle();
      return this.result('capture_adjustment', null);
    }
    if (measurement.status !== 'measured') {
      this.resetCycle();
      return this.result('low_confidence', null);
    }

    const angle = this.smooth(measurement.angle_degrees);
    this.lastTimestamp = frame.timestamp_ms;
    const { initial_angle_degrees, peak_angle_degrees } = this.rule.phases;
    if (this.phase === 'awaiting_initial') {
      if (isWithin(angle, initial_angle_degrees)) {
        this.phase = 'ascending';
        this.movementStartedAt = frame.timestamp_ms;
        this.lastAngle = angle;
        return this.result('ready', angle);
      }
      return this.result('capture_adjustment', angle);
    }

    if (this.phase === 'ascending') {
      if (this.reversedFromLastAngle(angle, 'ascending')) {
        this.resetCycle();
        return this.result('movement_in_progress', angle);
      }
      if (isWithin(angle, peak_angle_degrees)) {
        this.phase = 'descending';
        this.lastAngle = angle;
        return this.result('movement_in_progress', angle);
      }
      if (this.movedOppositeDirection(angle)) {
        this.resetCycle();
        return this.result('movement_in_progress', angle);
      }
      this.lastAngle = angle;
      return this.result('movement_in_progress', angle);
    }

    if (this.reversedFromLastAngle(angle, 'descending')) {
      this.resetCycle();
      return this.result('movement_in_progress', angle);
    }
    if (isWithin(angle, initial_angle_degrees)) {
      const startedAt = this.movementStartedAt;
      this.resetCycle();
      if (
        startedAt !== null &&
        frame.timestamp_ms - startedAt >=
          this.rule.phases.minimum_cycle_duration_ms
      ) {
        this.repetitions += 1;
        return this.result('rep_completed', angle);
      }
      return this.result('movement_in_progress', angle);
    }
    this.lastAngle = angle;
    return this.result('movement_in_progress', angle);
  }

  private movedOppositeDirection(angle: number): boolean {
    const initial = this.rule.phases.initial_angle_degrees;
    return this.rule.phases.direction_to_peak === 'increasing'
      ? angle < initial[0]
      : angle > initial[1];
  }

  private resetCycle(): void {
    this.phase = 'awaiting_initial';
    this.movementStartedAt = null;
    this.lastAngle = null;
    this.lastTimestamp = null;
    this.recentAngles.length = 0;
  }

  private smooth(angle: number): number {
    this.recentAngles.push(angle);
    if (this.recentAngles.length > this.options.smoothing_window_size) {
      this.recentAngles.shift();
    }
    return (
      this.recentAngles.reduce((sum, value) => sum + value, 0) /
      this.recentAngles.length
    );
  }

  private reversedFromLastAngle(
    angle: number,
    phase: 'ascending' | 'descending',
  ): boolean {
    if (this.lastAngle === null) {
      return false;
    }
    const movesUp = this.rule.phases.direction_to_peak === 'increasing';
    const shouldIncrease = phase === 'ascending' ? movesUp : !movesUp;
    return shouldIncrease ? angle < this.lastAngle : angle > this.lastAngle;
  }

  private result(
    feedback: MovementUpdate['feedback'],
    angle_degrees: number | null,
  ): MovementUpdate {
    return {
      phase: this.phase,
      repetitions: this.repetitions,
      feedback,
      angle_degrees,
    };
  }
}

function isWithin(value: number, range: readonly [number, number]): boolean {
  return value >= range[0] && value <= range[1];
}

function validateRule(rule: ApprovedMovementRule): void {
  const validRange = (range: readonly [number, number]) =>
    Number.isFinite(range[0]) &&
    Number.isFinite(range[1]) &&
    range[0] >= 0 &&
    range[1] <= 180 &&
    range[0] <= range[1];
  const validConfidence = (value: number) =>
    Number.isFinite(value) && value >= 0 && value <= 1;
  if (
    !rule.exercise_code.trim() ||
    !rule.rule_version.trim() ||
    !validConfidence(rule.confidence.minimum_visibility) ||
    !validConfidence(rule.confidence.minimum_presence) ||
    !validRange(rule.phases.initial_angle_degrees) ||
    !validRange(rule.phases.peak_angle_degrees) ||
    !Number.isInteger(rule.phases.minimum_cycle_duration_ms) ||
    rule.phases.minimum_cycle_duration_ms <= 0 ||
    !Number.isInteger(rule.phases.maximum_frame_gap_ms) ||
    rule.phases.maximum_frame_gap_ms <= 0 ||
    !validRange(rule.calibration.allowed_reference_degrees) ||
    !Number.isInteger(rule.calibration.required_samples) ||
    rule.calibration.required_samples <= 0 ||
    !Number.isFinite(rule.calibration.maximum_sample_spread_degrees) ||
    rule.calibration.maximum_sample_spread_degrees < 0
  ) {
    throw new Error('A regra aprovada possui limites técnicos inválidos.');
  }
}
