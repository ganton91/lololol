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

function createQuantizedRotationSignature(cos, sin, precisionDecimals = 8) {
  return createRotationSignature(
    quantizeAngleValue(cos, precisionDecimals),
    quantizeAngleValue(sin, precisionDecimals)
  );
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

function normalizeRotationVector(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 1e-12) return null;

  return {
    dx: dx / length,
    dy: dy / length,
  };
}

function buildDraftAngleEntry(record, stepIndex, trigPrecisionDecimals) {
  const canonicalStepIndex = normalizeDraftAngleStep(stepIndex, record.stepCount);
  let cos;
  let sin;
  let canonicalAngleDeg;
  let signedAngleDeg;
  let angleRad;
  if (Number.isFinite(record.baseVectorDx) && Number.isFinite(record.baseVectorDy)) {
    const baseVector = normalizeRotationVector(record.baseVectorDx, record.baseVectorDy) || { dx: 1, dy: 0 };
    const stepAngleRad = ((canonicalStepIndex * record.stepDegrees) * Math.PI) / 180;
    const stepCos = quantizeAngleValue(Math.cos(stepAngleRad), trigPrecisionDecimals);
    const stepSin = quantizeAngleValue(Math.sin(stepAngleRad), trigPrecisionDecimals);
    const composedVector =
      normalizeRotationVector(
        baseVector.dx * stepCos - baseVector.dy * stepSin,
        baseVector.dy * stepCos + baseVector.dx * stepSin
      ) || baseVector;
    cos = quantizeAngleValue(composedVector.dx, trigPrecisionDecimals);
    sin = quantizeAngleValue(composedVector.dy, trigPrecisionDecimals);
    angleRad = Math.atan2(sin, cos);
    canonicalAngleDeg = normalizeDegrees360((angleRad * 180) / Math.PI);
    signedAngleDeg = normalizeDegreesSigned(canonicalAngleDeg);
    angleRad = (signedAngleDeg * Math.PI) / 180;
  } else {
    canonicalAngleDeg = normalizeDegrees360(record.baseAngleDeg + canonicalStepIndex * record.stepDegrees);
    signedAngleDeg = normalizeDegreesSigned(canonicalAngleDeg);
    angleRad = (signedAngleDeg * Math.PI) / 180;
    cos = quantizeAngleValue(Math.cos(angleRad), trigPrecisionDecimals);
    sin = quantizeAngleValue(Math.sin(angleRad), trigPrecisionDecimals);
  }

  return {
    mode: "family",
    familyId: record.id,
    stepIndex: canonicalStepIndex,
    angleDeg: canonicalAngleDeg,
    signedAngleDeg,
    angleRad,
    cos,
    sin,
    signature: createQuantizedRotationSignature(cos, sin, trigPrecisionDecimals),
  };
}

export function buildDraftAngleFamilyRuntime(record, trigPrecisionDecimals = 8) {
  const normalizedBaseVector =
    Number.isFinite(record.baseVectorDx) && Number.isFinite(record.baseVectorDy)
      ? normalizeRotationVector(record.baseVectorDx, record.baseVectorDy)
      : null;
  const normalizedBaseAngleDeg = normalizedBaseVector
    ? normalizeDegrees360((Math.atan2(normalizedBaseVector.dy, normalizedBaseVector.dx) * 180) / Math.PI)
    : normalizeDegrees360(record.baseAngleDeg);
  const normalizedRecord = {
    ...record,
    baseAngleDeg: normalizedBaseAngleDeg,
    baseVectorDx: normalizedBaseVector ? normalizedBaseVector.dx : undefined,
    baseVectorDy: normalizedBaseVector ? normalizedBaseVector.dy : undefined,
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
    signature: createQuantizedRotationSignature(cos, sin, trigPrecisionDecimals),
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
