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

function buildDraftAngleEntry(record, stepIndex, precisionDecimals) {
  const canonicalStepIndex = normalizeDraftAngleStep(stepIndex, record.stepCount);
  const canonicalAngleDeg = quantizeAngleValue(
    normalizeDegrees360(record.baseAngleDeg + canonicalStepIndex * record.stepDegrees),
    precisionDecimals
  );
  const signedAngleDeg = quantizeAngleValue(normalizeDegreesSigned(canonicalAngleDeg), precisionDecimals);
  const angleRad = (signedAngleDeg * Math.PI) / 180;
  const cos = quantizeAngleValue(Math.cos(angleRad), precisionDecimals);
  const sin = quantizeAngleValue(Math.sin(angleRad), precisionDecimals);

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

export function buildDraftAngleFamilyRuntime(record, precisionDecimals = 8) {
  const normalizedRecord = {
    ...record,
    baseAngleDeg: quantizeAngleValue(normalizeDegrees360(record.baseAngleDeg), precisionDecimals),
  };
  const entries = Array.from({ length: normalizedRecord.stepCount }, (_, stepIndex) =>
    buildDraftAngleEntry(normalizedRecord, stepIndex, precisionDecimals)
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

export function createFreeDraftAngleRotation(baseAngleDeg, stepIndex = 0, precisionDecimals = 8) {
  const canonicalBaseAngleDeg = quantizeAngleValue(normalizeDegrees360(baseAngleDeg), precisionDecimals);
  const canonicalStepIndex = normalizeDraftAngleStep(stepIndex);
  const canonicalAngleDeg = quantizeAngleValue(
    normalizeDegrees360(canonicalBaseAngleDeg + canonicalStepIndex),
    precisionDecimals
  );
  const signedAngleDeg = quantizeAngleValue(normalizeDegreesSigned(canonicalAngleDeg), precisionDecimals);
  const angleRad = (signedAngleDeg * Math.PI) / 180;
  const cos = quantizeAngleValue(Math.cos(angleRad), precisionDecimals);
  const sin = quantizeAngleValue(Math.sin(angleRad), precisionDecimals);

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

export function findDraftAngleFamilyMatchByDegrees(angleDeg, familyRuntimes, precisionDecimals = 8) {
  const freeRotation = createFreeDraftAngleRotation(angleDeg, 0, precisionDecimals);

  for (const familyRuntime of familyRuntimes) {
    const stepIndex = familyRuntime.signatureToStepIndex.get(freeRotation.signature);
    if (stepIndex === undefined) continue;

    return getDraftAngleFamilyEntry(familyRuntime, stepIndex);
  }

  return null;
}
