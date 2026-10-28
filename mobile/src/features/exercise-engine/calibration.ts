import type {
  ApprovedMovementRule,
  CalibrationContext,
  MovementCalibration,
} from './types';

export function createCalibration(
  context: CalibrationContext,
  angleSamples: readonly number[],
  rule: ApprovedMovementRule,
  calibratedAt: string,
): MovementCalibration {
  if (
    rule.approval_status !== 'approved' ||
    rule.rule_version !== context.rule_version ||
    rule.approved_rule_version !== context.rule_version
  ) {
    throw new Error('A calibração exige a regra aprovada da mesma versão.');
  }
  const policy = rule.calibration;
  if (
    !Number.isInteger(policy.required_samples) ||
    policy.required_samples <= 0 ||
    !Number.isFinite(policy.maximum_sample_spread_degrees) ||
    policy.maximum_sample_spread_degrees < 0 ||
    !Number.isFinite(policy.allowed_reference_degrees[0]) ||
    !Number.isFinite(policy.allowed_reference_degrees[1]) ||
    policy.allowed_reference_degrees[0] < 0 ||
    policy.allowed_reference_degrees[1] > 180 ||
    policy.allowed_reference_degrees[0] > policy.allowed_reference_degrees[1]
  ) {
    throw new Error('A política aprovada de calibração não é válida.');
  }
  if (angleSamples.length < policy.required_samples) {
    throw new Error('A calibração não reuniu amostras suficientes.');
  }
  if (angleSamples.some(value => !Number.isFinite(value))) {
    throw new Error('A calibração recebeu uma medida inválida.');
  }

  const minimum = Math.min(...angleSamples);
  const maximum = Math.max(...angleSamples);
  if (maximum - minimum > policy.maximum_sample_spread_degrees) {
    throw new Error('A posição variou além do limite de calibração aprovado.');
  }
  const reference = angleSamples.reduce((sum, value) => sum + value, 0) /
    angleSamples.length;
  if (
    reference < policy.allowed_reference_degrees[0] ||
    reference > policy.allowed_reference_degrees[1]
  ) {
    throw new Error('A referência está fora dos limites aprovados.');
  }
  if (Number.isNaN(Date.parse(calibratedAt))) {
    throw new Error('A data da calibração é inválida.');
  }
  return {
    ...context,
    reference_angle_degrees: reference,
    calibrated_at: new Date(calibratedAt).toISOString(),
  };
}

export function calibrationMatches(
  stored: MovementCalibration,
  expected: CalibrationContext,
): boolean {
  return (
    stored.owner_user_id === expected.owner_user_id &&
    stored.exercise_id === expected.exercise_id &&
    stored.workout_id === expected.workout_id &&
    stored.workout_revision_id === expected.workout_revision_id &&
    stored.workout_item_id === expected.workout_item_id &&
    stored.rule_version === expected.rule_version
  );
}
