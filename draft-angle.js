const FULL_TURN_DEGREES = 360;
const HALF_TURN_DEGREES = FULL_TURN_DEGREES / 2;
const DEFAULT_CANDIDATE_FAMILY_ID = "draft-angle-candidate";

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

function sanitizeStepDegrees(stepDegrees) {
  if (!Number.isFinite(stepDegrees) || Math.abs(stepDegrees) <= 1e-12) {
    return DEFAULT_DRAFT_ANGLE_FAMILY_RECORD.stepDegrees;
  }

  return Math.abs(stepDegrees);
}

function sanitizeStepCount(stepCount) {
  const integerStepCount = Math.trunc(stepCount);
  if (!Number.isFinite(integerStepCount) || integerStepCount <= 0) {
    return DEFAULT_DRAFT_ANGLE_FAMILY_RECORD.stepCount;
  }

  return integerStepCount;
}

function normalizeRotationVector(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 1e-12) return null;

  return {
    dx: dx / length,
    dy: dy / length,
  };
}

function canonicalizeDirectionVector(dx, dy, precisionDecimals = 8) {
  const normalized = normalizeRotationVector(dx, dy);
  if (!normalized) return null;

  return {
    dx: quantizeAngleValue(normalized.dx, precisionDecimals),
    dy: quantizeAngleValue(normalized.dy, precisionDecimals),
  };
}

function getDirectionAngleDegrees(dx, dy) {
  return normalizeDegrees360((Math.atan2(dy, dx) * 180) / Math.PI);
}

function getDirectionSignature(dx, dy, precisionDecimals = 8) {
  const normalized = normalizeRotationVector(dx, dy);
  if (!normalized) return null;

  return createRotationSignature(
    quantizeAngleValue(normalized.dx, precisionDecimals),
    quantizeAngleValue(normalized.dy, precisionDecimals)
  );
}

function cloneRecord(record) {
  return record ? { ...record } : null;
}

function cloneActiveState(activeState) {
  return activeState
    ? {
        mode: activeState.mode,
        familyId: activeState.familyId ?? null,
        stepIndex: activeState.stepIndex ?? 0,
        baseAngleDeg: activeState.baseAngleDeg ?? 0,
      }
    : null;
}

function createDraftAngleFamilyRecord(id, baseAngleDeg, kind = "dynamic", name = null) {
  const canonicalBaseAngleDeg = normalizeDegrees360(baseAngleDeg);
  return {
    id,
    kind,
    name: name || (kind === "candidate" ? "Candidate" : `Dynamic ${canonicalBaseAngleDeg}deg`),
    baseAngleDeg: canonicalBaseAngleDeg,
    stepDegrees: DEFAULT_DRAFT_ANGLE_FAMILY_RECORD.stepDegrees,
    stepCount: DEFAULT_DRAFT_ANGLE_FAMILY_RECORD.stepCount,
  };
}

function createDraftAngleFamilyRecordFromVector(id, dx, dy, kind = "dynamic", name = null, precisionDecimals = 8) {
  const canonicalDirection = canonicalizeDirectionVector(dx, dy, precisionDecimals);
  if (!canonicalDirection) return createDraftAngleFamilyRecord(id, 0, kind, name);

  const baseAngleDeg = getDirectionAngleDegrees(canonicalDirection.dx, canonicalDirection.dy);
  return {
    ...createDraftAngleFamilyRecord(id, baseAngleDeg, kind, name),
    baseVectorDx: canonicalDirection.dx,
    baseVectorDy: canonicalDirection.dy,
  };
}

function normalizeDraftAngleRecord(record, precisionDecimals = 8) {
  const canonicalBaseVector =
    Number.isFinite(record?.baseVectorDx) && Number.isFinite(record?.baseVectorDy)
      ? canonicalizeDirectionVector(record.baseVectorDx, record.baseVectorDy, precisionDecimals)
      : null;
  const normalizedBaseAngleDeg = canonicalBaseVector
    ? normalizeDegrees360((Math.atan2(canonicalBaseVector.dy, canonicalBaseVector.dx) * 180) / Math.PI)
    : normalizeDegrees360(record?.baseAngleDeg ?? 0);

  return {
    ...record,
    kind: record?.kind || "dynamic",
    name:
      record?.name ||
      ((record?.kind || "dynamic") === "candidate" ? "Candidate" : `Dynamic ${normalizedBaseAngleDeg}deg`),
    baseAngleDeg: normalizedBaseAngleDeg,
    baseVectorDx: canonicalBaseVector ? canonicalBaseVector.dx : undefined,
    baseVectorDy: canonicalBaseVector ? canonicalBaseVector.dy : undefined,
    stepDegrees: sanitizeStepDegrees(record?.stepDegrees),
    stepCount: sanitizeStepCount(record?.stepCount),
  };
}

function getDraftAngleRecordBaseDirection(record, precisionDecimals = 8) {
  if (!record) return null;

  if (Number.isFinite(record.baseVectorDx) && Number.isFinite(record.baseVectorDy)) {
    return {
      dx: record.baseVectorDx,
      dy: record.baseVectorDy,
    };
  }

  if (Number.isFinite(record.baseAngleDeg)) {
    const angleRad = (record.baseAngleDeg * Math.PI) / 180;
    return {
      dx: quantizeAngleValue(Math.cos(angleRad), precisionDecimals),
      dy: quantizeAngleValue(Math.sin(angleRad), precisionDecimals),
    };
  }

  return null;
}

function buildDraftAngleEntry(record, stepIndex, trigPrecisionDecimals) {
  const canonicalStepIndex = normalizeDraftAngleStep(stepIndex, record.stepCount);
  let cos;
  let sin;
  let canonicalAngleDeg;
  let signedAngleDeg;
  let angleRad;

  if (Number.isFinite(record.baseVectorDx) && Number.isFinite(record.baseVectorDy)) {
    const baseVector = getDraftAngleRecordBaseDirection(record, trigPrecisionDecimals) || { dx: 1, dy: 0 };
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
  const normalizedRecord = normalizeDraftAngleRecord(record, trigPrecisionDecimals);
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

function findDraftAngleFamilyMatchBySignature(signature, familyRuntimes) {
  if (!signature) return null;

  for (const familyRuntime of familyRuntimes) {
    const stepIndex = familyRuntime.signatureToStepIndex.get(signature);
    if (stepIndex === undefined) continue;

    return getDraftAngleFamilyEntry(familyRuntime, stepIndex);
  }

  return null;
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

export function createDraftAngleStore(options = {}) {
  const precisionDecimals =
    Number.isFinite(options.precisionDecimals) && options.precisionDecimals >= 0
      ? Math.trunc(options.precisionDecimals)
      : 8;
  const candidateFamilyId = options.candidateFamilyId || DEFAULT_CANDIDATE_FAMILY_ID;
  const familyRuntimes = new Map();
  const initialFamilyRecords =
    Array.isArray(options.familyRecords) && options.familyRecords.length
      ? options.familyRecords
      : [DEFAULT_DRAFT_ANGLE_FAMILY_RECORD];
  let candidateRuntime = options.candidateRecord
    ? buildDraftAngleFamilyRuntime(
        {
          ...options.candidateRecord,
          id: candidateFamilyId,
          kind: "candidate",
          name: options.candidateRecord.name || "Candidate",
        },
        precisionDecimals
      )
    : null;
  let activeState = cloneActiveState(options.activeState) || {
    mode: "family",
    familyId: DEFAULT_DRAFT_ANGLE_FAMILY_ID,
    stepIndex: 0,
    baseAngleDeg: DEFAULT_DRAFT_ANGLE_FAMILY_RECORD.baseAngleDeg,
  };
  let nextFamilyId = 1;

  function registerFamilyRecord(record) {
    const runtime = buildDraftAngleFamilyRuntime(record, precisionDecimals);
    familyRuntimes.set(runtime.record.id, runtime);
    return runtime;
  }

  function rebuildNextFamilyId() {
    let maxFamilyIndex = 0;
    for (const familyRuntime of familyRuntimes.values()) {
      const match = /^draft-angle-family-(\d+)$/.exec(familyRuntime.record.id);
      if (!match) continue;
      maxFamilyIndex = Math.max(maxFamilyIndex, Number(match[1]));
    }

    nextFamilyId = Math.max(
      Number.isFinite(options.nextFamilyId) ? Math.trunc(options.nextFamilyId) : 1,
      maxFamilyIndex + 1
    );
  }

  function getFamilyRuntime(familyId) {
    return familyRuntimes.get(familyId) || null;
  }

  function clearCandidate() {
    candidateRuntime = null;
  }

  function getActiveRotation() {
    if (activeState.mode === "family" && activeState.familyId) {
      const familyRuntime = getFamilyRuntime(activeState.familyId);
      if (familyRuntime) {
        return getDraftAngleFamilyEntry(familyRuntime, activeState.stepIndex);
      }
    }

    if (activeState.mode === "candidate" && candidateRuntime) {
      return getDraftAngleFamilyEntry(candidateRuntime, activeState.stepIndex);
    }

    return createFreeDraftAngleRotation(activeState.baseAngleDeg || 0, activeState.stepIndex || 0, precisionDecimals);
  }

  function getActiveStepCount() {
    if (activeState.mode === "family" && activeState.familyId) {
      return getFamilyRuntime(activeState.familyId)?.record.stepCount || FULL_TURN_DEGREES;
    }

    if (activeState.mode === "candidate") {
      return candidateRuntime?.record.stepCount || FULL_TURN_DEGREES;
    }

    return FULL_TURN_DEGREES;
  }

  function setActiveState(nextState) {
    activeState = {
      mode: nextState.mode,
      familyId: nextState.familyId ?? null,
      stepIndex: nextState.stepIndex ?? 0,
      baseAngleDeg: nextState.baseAngleDeg ?? 0,
    };

    return getActiveRotation();
  }

  function setActiveFamily(familyId, stepIndex = 0) {
    const familyRuntime = getFamilyRuntime(familyId);
    if (!familyRuntime) {
      return setFreeAngle(0, 0);
    }

    clearCandidate();
    return setActiveState({
      mode: "family",
      familyId,
      stepIndex: normalizeDraftAngleStep(stepIndex, familyRuntime.record.stepCount),
      baseAngleDeg: familyRuntime.record.baseAngleDeg,
    });
  }

  function setCandidateRuntime(runtime, stepIndex = 0) {
    if (!runtime) {
      return setFreeAngle(0, 0);
    }

    candidateRuntime = runtime;
    return setActiveState({
      mode: "candidate",
      familyId: null,
      stepIndex: normalizeDraftAngleStep(stepIndex, runtime.record.stepCount),
      baseAngleDeg: runtime.record.baseAngleDeg,
    });
  }

  function setCandidateFromAngle(baseAngleDeg, stepIndex = 0, existingRecord = null) {
    const candidateRecord =
      existingRecord ||
      createDraftAngleFamilyRecord(candidateFamilyId, baseAngleDeg, "candidate", "Candidate");
    return setCandidateRuntime(
      buildDraftAngleFamilyRuntime(
        {
          ...candidateRecord,
          id: candidateFamilyId,
          kind: "candidate",
          name: candidateRecord.name || "Candidate",
        },
        precisionDecimals
      ),
      stepIndex
    );
  }

  function setCandidateFromVector(dx, dy, stepIndex = 0, existingRecord = null) {
    const candidateRecord =
      existingRecord ||
      createDraftAngleFamilyRecordFromVector(candidateFamilyId, dx, dy, "candidate", "Candidate", precisionDecimals);
    return setCandidateRuntime(
      buildDraftAngleFamilyRuntime(
        {
          ...candidateRecord,
          id: candidateFamilyId,
          kind: "candidate",
          name: candidateRecord.name || "Candidate",
        },
        precisionDecimals
      ),
      stepIndex
    );
  }

  function setFreeAngle(baseAngleDeg, stepIndex = 0) {
    clearCandidate();
    return setActiveState({
      mode: "free",
      familyId: null,
      stepIndex: normalizeDraftAngleStep(stepIndex),
      baseAngleDeg: normalizeDegrees360(baseAngleDeg),
    });
  }

  function resolveAngle(angleDeg) {
    const familyMatch = findDraftAngleFamilyMatchByDegrees(angleDeg, familyRuntimes.values(), precisionDecimals);
    if (familyMatch) {
      return setActiveFamily(familyMatch.familyId, familyMatch.stepIndex);
    }

    return setFreeAngle(angleDeg, 0);
  }

  function findCandidateMatchByDegrees(angleDeg) {
    if (!candidateRuntime) return null;

    const freeRotation = createFreeDraftAngleRotation(angleDeg, 0, precisionDecimals);
    const stepIndex = candidateRuntime.signatureToStepIndex.get(freeRotation.signature);
    if (stepIndex === undefined) return null;

    return getDraftAngleFamilyEntry(candidateRuntime, stepIndex);
  }

  function findCandidateMatchBySignature(signature) {
    if (!candidateRuntime || !signature) return null;

    const stepIndex = candidateRuntime.signatureToStepIndex.get(signature);
    if (stepIndex === undefined) return null;

    return getDraftAngleFamilyEntry(candidateRuntime, stepIndex);
  }

  function resolveAlignedAngle(angleDeg) {
    const familyMatch = findDraftAngleFamilyMatchByDegrees(angleDeg, familyRuntimes.values(), precisionDecimals);
    if (familyMatch) {
      return setActiveFamily(familyMatch.familyId, familyMatch.stepIndex);
    }

    const candidateMatch = findCandidateMatchByDegrees(angleDeg);
    if (candidateMatch && candidateRuntime) {
      return setCandidateFromAngle(candidateRuntime.record.baseAngleDeg, candidateMatch.stepIndex, candidateRuntime.record);
    }

    return setCandidateFromAngle(angleDeg, 0);
  }

  function resolveAlignedDirection(dx, dy) {
    const normalized = normalizeRotationVector(dx, dy);
    if (!normalized) return null;

    const signature = getDirectionSignature(normalized.dx, normalized.dy, precisionDecimals);
    const familyMatch = findDraftAngleFamilyMatchBySignature(signature, familyRuntimes.values());
    if (familyMatch) {
      return setActiveFamily(familyMatch.familyId, familyMatch.stepIndex);
    }

    const candidateMatch = findCandidateMatchBySignature(signature);
    if (candidateMatch && candidateRuntime) {
      const candidateBaseDirection = getDraftAngleRecordBaseDirection(candidateRuntime.record);
      if (candidateBaseDirection) {
        return setCandidateFromVector(
          candidateBaseDirection.dx,
          candidateBaseDirection.dy,
          candidateMatch.stepIndex,
          candidateRuntime.record
        );
      }

      return setCandidateFromAngle(candidateRuntime.record.baseAngleDeg, candidateMatch.stepIndex, candidateRuntime.record);
    }

    return setCandidateFromVector(normalized.dx, normalized.dy, 0);
  }

  function rotateStep(stepDelta) {
    if (!Number.isFinite(stepDelta) || !stepDelta) return getActiveRotation();

    return setActiveState({
      ...activeState,
      stepIndex: normalizeDraftAngleStep(activeState.stepIndex + Math.trunc(stepDelta), getActiveStepCount()),
    });
  }

  function materializeActiveCandidate() {
    if (activeState.mode !== "candidate") return null;

    const candidateRecord = candidateRuntime?.record;
    if (!candidateRecord) {
      setFreeAngle(activeState.baseAngleDeg || 0, activeState.stepIndex || 0);
      return null;
    }

    const activeStepIndex = activeState.stepIndex;
    const activeRotation = getActiveRotation();
    const existingFamilyMatch = findDraftAngleFamilyMatchBySignature(activeRotation.signature, familyRuntimes.values());
    if (existingFamilyMatch) {
      setActiveFamily(existingFamilyMatch.familyId, existingFamilyMatch.stepIndex);
      return existingFamilyMatch;
    }

    const candidateBaseDirection = getDraftAngleRecordBaseDirection(candidateRecord);
    const familyRecord = candidateBaseDirection
      ? {
          ...cloneRecord(candidateRecord),
          id: `draft-angle-family-${nextFamilyId++}`,
          kind: "dynamic",
          name: `Dynamic ${candidateRecord.baseAngleDeg}deg`,
        }
      : createDraftAngleFamilyRecord(
          `draft-angle-family-${nextFamilyId++}`,
          candidateRecord.baseAngleDeg,
          "dynamic"
        );

    registerFamilyRecord(familyRecord);
    setActiveFamily(familyRecord.id, activeStepIndex);
    return cloneRecord(familyRecord);
  }

  function resetToDefault() {
    return setActiveFamily(DEFAULT_DRAFT_ANGLE_FAMILY_ID, 0);
  }

  function getRegistryRows() {
    return Array.from(familyRuntimes.values()).map((familyRuntime) => {
      const baseRotation = getDraftAngleFamilyEntry(familyRuntime, 0);
      return {
        id: familyRuntime.record.id,
        kind: familyRuntime.record.kind,
        baseAngleDeg: familyRuntime.record.baseAngleDeg,
        baseVectorDx: baseRotation ? baseRotation.cos : null,
        baseVectorDy: baseRotation ? baseRotation.sin : null,
        stepDegrees: familyRuntime.record.stepDegrees,
        stepCount: familyRuntime.record.stepCount,
      };
    });
  }

  function getSnapshot() {
    return {
      nextFamilyId,
      familyRecords: Array.from(familyRuntimes.values(), (familyRuntime) => cloneRecord(familyRuntime.record)),
      candidateRecord: candidateRuntime ? cloneRecord(candidateRuntime.record) : null,
      activeState: cloneActiveState(activeState),
      activeRotation: { ...getActiveRotation() },
    };
  }

  for (const familyRecord of initialFamilyRecords) {
    registerFamilyRecord(familyRecord);
  }

  if (!familyRuntimes.has(DEFAULT_DRAFT_ANGLE_FAMILY_ID)) {
    registerFamilyRecord(DEFAULT_DRAFT_ANGLE_FAMILY_RECORD);
  }

  rebuildNextFamilyId();

  if (activeState.mode === "family" && activeState.familyId && familyRuntimes.has(activeState.familyId)) {
    setActiveFamily(activeState.familyId, activeState.stepIndex);
  } else if (activeState.mode === "candidate" && candidateRuntime) {
    setCandidateRuntime(candidateRuntime, activeState.stepIndex);
  } else if (activeState.mode === "free") {
    setFreeAngle(activeState.baseAngleDeg, activeState.stepIndex);
  } else {
    resetToDefault();
  }

  return {
    getActiveRotation,
    getActiveStepCount,
    getSnapshot,
    getRegistryRows,
    materializeActiveCandidate,
    resetToDefault,
    resolveAlignedAngle,
    resolveAlignedDirection,
    resolveAngle,
    rotateStep,
    setActiveFamily,
    setFreeAngle,
  };
}
