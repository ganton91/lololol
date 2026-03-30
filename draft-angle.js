const FULL_TURN_DEGREES = 360;
const HALF_TURN_DEGREES = FULL_TURN_DEGREES / 2;

export const DEFAULT_DRAFT_ANGLE_FAMILY_ID = "draft-angle-default-1deg";
export const DEFAULT_DRAFT_ANGLE_FAMILY_RECORD = Object.freeze({
  id: DEFAULT_DRAFT_ANGLE_FAMILY_ID,
  kind: "default",
  name: "Default 1deg",
  baseAngleDeg: 0,
  stepDegrees: 1,
  stepCount: FULL_TURN_DEGREES,
});

function getPrecisionFactor(precisionDecimals) {
  return 10 ** precisionDecimals;
}

function createRotationSignature(cos, sin) {
  return `${cos}:${sin}`;
}

export function quantizeAngleValue(value, precisionDecimals = 8) {
  const factor = getPrecisionFactor(precisionDecimals);
  return Math.round(value * factor) / factor;
}

export function normalizeDegrees360(angleDeg) {
  let nextAngle = angleDeg % FULL_TURN_DEGREES;
  if (nextAngle < 0) nextAngle += FULL_TURN_DEGREES;
  return nextAngle;
}

export function normalizeDegreesSigned(angleDeg) {
  const normalized = normalizeDegrees360(angleDeg);
  return normalized > HALF_TURN_DEGREES ? normalized - FULL_TURN_DEGREES : normalized;
}

export function normalizeDraftAngleStep(stepIndex, stepCount = FULL_TURN_DEGREES) {
  if (!Number.isFinite(stepIndex) || !Number.isFinite(stepCount) || stepCount <= 0) return 0;
  const integerStep = Math.trunc(stepIndex);
  return ((integerStep % stepCount) + stepCount) % stepCount;
}

function buildDraftAngleEntry(record, stepIndex, trigPrecisionDecimals) {
  const canonicalStepIndex = normalizeDraftAngleStep(stepIndex, record.stepCount);
  const canonicalAngleDeg = normalizeDegrees360(record.baseAngleDeg + canonicalStepIndex * record.stepDegrees);
  const signedAngleDeg = normalizeDegreesSigned(canonicalAngleDeg);
  const angleRad = (signedAngleDeg * Math.PI) / 180;
  const cos = quantizeAngleValue(Math.cos(angleRad), trigPrecisionDecimals);
  const sin = quantizeAngleValue(Math.sin(angleRad), trigPrecisionDecimals);

  return {
    mode: "family",
    familyId: record.id,
    stepIndex: canonicalStepIndex,
    angleDeg: canonicalAngleDeg,
    signedAngleDeg,
    angleRad,
    cos,
    sin,
    signature: createRotationSignature(cos, sin),
  };
}

export function buildDraftAngleFamilyRuntime(record, trigPrecisionDecimals = 8) {
  const normalizedRecord = {
    ...record,
    baseAngleDeg: normalizeDegrees360(record.baseAngleDeg),
  };
  const entries = Array.from({ length: normalizedRecord.stepCount }, (_, stepIndex) =>
    buildDraftAngleEntry(normalizedRecord, stepIndex, trigPrecisionDecimals)
  );
  const signatureToStepIndex = new Map(entries.map((entry) => [entry.signature, entry.stepIndex]));

  return {
    record: normalizedRecord,
    entries,
    signatureToStepIndex,
  };
}

export function getDraftAngleFamilyEntry(familyRuntime, stepIndex) {
  return familyRuntime.entries[normalizeDraftAngleStep(stepIndex, familyRuntime.record.stepCount)];
}

export function createFreeDraftAngleRotation(baseAngleDeg, stepIndex = 0, trigPrecisionDecimals = 8) {
  const canonicalBaseAngleDeg = normalizeDegrees360(baseAngleDeg);
  const canonicalStepIndex = normalizeDraftAngleStep(stepIndex);
  const canonicalAngleDeg = normalizeDegrees360(canonicalBaseAngleDeg + canonicalStepIndex);
  const signedAngleDeg = normalizeDegreesSigned(canonicalAngleDeg);
  const angleRad = (signedAngleDeg * Math.PI) / 180;
  const cos = quantizeAngleValue(Math.cos(angleRad), trigPrecisionDecimals);
  const sin = quantizeAngleValue(Math.sin(angleRad), trigPrecisionDecimals);

  return {
    mode: "free",
    familyId: null,
    stepIndex: canonicalStepIndex,
    baseAngleDeg: canonicalBaseAngleDeg,
    angleDeg: canonicalAngleDeg,
    signedAngleDeg,
    angleRad,
    cos,
    sin,
    signature: createRotationSignature(cos, sin),
  };
}

export function findDraftAngleFamilyMatchByDegrees(angleDeg, familyRuntimes, trigPrecisionDecimals = 8) {
  const freeRotation = createFreeDraftAngleRotation(angleDeg, 0, trigPrecisionDecimals);

  for (const familyRuntime of familyRuntimes) {
    const stepIndex = familyRuntime.signatureToStepIndex.get(freeRotation.signature);
    if (stepIndex === undefined) continue;

    return getDraftAngleFamilyEntry(familyRuntime, stepIndex);
  }

  return null;
}
