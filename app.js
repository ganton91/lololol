import { ClipType, FillRule, PolyTree64, booleanOpWithPolyTree, isPositive, simplifyPaths } from "clipper2-ts";
import {
  DEFAULT_DRAFT_ANGLE_FAMILY_ID,
  DEFAULT_DRAFT_ANGLE_FAMILY_RECORD,
  buildDraftAngleFamilyRuntime,
  createFreeDraftAngleRotation,
  findDraftAngleFamilyMatchByDegrees,
  getDraftAngleFamilyEntry,
  normalizeDegrees360,
  normalizeDraftAngleStep,
  quantizeAngleValue,
} from "./draft-angle.js";

const canvas = document.getElementById("cad-canvas");
const ctx = canvas.getContext("2d");
const selectBtn = document.getElementById("select-tool");
const drawBtn = document.getElementById("draw-tool");
const shapeSelect = document.getElementById("shape-select");
const drawSizeInput = document.getElementById("draw-size");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomInBtn = document.getElementById("zoom-in");
const zoomLevel = document.getElementById("zoom-level");
const workplaneStatus = document.getElementById("workplane-status");
const layersList = document.getElementById("layers-list");
const layerAddBtn = document.getElementById("layer-add");
const layerDeleteBtn = document.getElementById("layer-delete");
const layerUpBtn = document.getElementById("layer-up");
const layerDownBtn = document.getElementById("layer-down");
const layerFillInput = document.getElementById("layer-fill");

const state = {
  tool: "draw",
  shapeType: "rect",
  shapes: [],
  layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false, fillColor: "#93c5fd" }],
  activeLayerId: "layer-1",
  nextLayerId: 2,
  nextShapeId: 1,
  nextDraftAngleFamilyId: 1,
  dragging: false,
  panning: false,
  draggingDraftOrigin: false,
  draggingDraftAlign: false,
  pointerInCanvas: false,
  pointerScreen: { x: 0, y: 0 },
  spacePressed: false,
  shiftPressed: false,
  start: { x: 0, y: 0 },
  current: { x: 0, y: 0 },
  draftStart: { x: 0, y: 0 },
  draftCurrent: { x: 0, y: 0 },
  panStart: { x: 0, y: 0 },
  panOrigin: { x: 0, y: 0 },
  draftOriginDragStartScreen: { x: 0, y: 0 },
  draftOriginDragStartOrigin: { x: 0, y: 0 },
  draftOriginDragRotation: null,
  draftAlignStartSnap: null,
  draftAlignCurrentSnap: null,
  drawSize: 1,
  stripCellWidth: 1,
  draftShape: null,
  brushLastPoint: null,
  brushPoints: [],
  squareBrushMemoryPoint: null,
  stripLockedAxis: null,
  stripLockAnchorScreen: null,
  squareBrushLockedAxis: null,
  squareBrushLockAnchorScreen: null,
  squareBrushLockAnchorDraft: null,
  drawOperation: "add",
  draftOrigin: { x: 0, y: 0 },
  draftAngleFamilies: [{ ...DEFAULT_DRAFT_ANGLE_FAMILY_RECORD }],
  draftAngleCandidate: null,
  draftAngle: {
    mode: "family",
    familyId: DEFAULT_DRAFT_ANGLE_FAMILY_ID,
    stepIndex: 0,
    baseAngleDeg: 0,
  },
  camera: { x: 0, y: 0, zoom: 1 },
  selection: {
    shapeIds: [],
    startWorld: null,
    shapeSnapshots: null,
    modified: false,
    mode: null,
    boxStartDraft: null,
    boxCurrentDraft: null,
    boxBaseShapeIds: null,
    modifierMode: null,
    pendingShapeId: null,
    pendingScreen: null,
  },
};

const outlineStrokeColor = "#0f172a";
const selectionStrokeColor = "#0ea5e9";
const previewStrokeColor = "#0284c7";
const previewStrokeWidth = 1.5;
const minZoom = 0.09;
const maxZoom = 2;
const ellipseSegments = 96;
const squareBrushAxisDecisionDistancePx = 18;
const squareBrushAxisDecisionBiasPx = 8;
const gridCellSize = 24;
const gridMidCellInterval = 10;
const gridMajorCellInterval = 20;
const snapPreviewSize = 8;
const draftTransformSnapRadiusPx = 14;
const draftTransformCornerSnapRadiusPx = 20;
const draftTransformCornerPriorityRadiusPx = 16;
const selectionToggleDragThresholdPx = 5;
const layerPalette = ["#93c5fd", "#86efac", "#fca5a5", "#fde68a", "#c4b5fd", "#fdba74", "#67e8f9"];
const clipperDecimals = 8;
const clipperScaleFactor = 10 ** clipperDecimals;
const geometryPrecisionDecimals = clipperDecimals;
const geometryPrecisionFactor = clipperScaleFactor;
const clipperFillRule = FillRule.NonZero;
const clipperSimplifyCollinearEpsilon = 0;
const draftAngleCandidateFamilyId = "draft-angle-candidate";
const draftAngleFamilyRuntimes = new Map();
let draftAngleCandidateRuntime = null;

function createDraftAngleFamilyRecord(id, baseAngleDeg, kind = "dynamic", name = null) {
  const canonicalBaseAngleDeg = quantizeAngleValue(normalizeDegrees360(baseAngleDeg), geometryPrecisionDecimals);
  return {
    id,
    kind,
    name: name || (kind === "candidate" ? "Candidate" : `Dynamic ${canonicalBaseAngleDeg}deg`),
    baseAngleDeg: canonicalBaseAngleDeg,
    stepDegrees: DEFAULT_DRAFT_ANGLE_FAMILY_RECORD.stepDegrees,
    stepCount: DEFAULT_DRAFT_ANGLE_FAMILY_RECORD.stepCount,
  };
}

function setDraftAngleCandidateRecord(record) {
  state.draftAngleCandidate = record ? { ...record } : null;
  draftAngleCandidateRuntime = state.draftAngleCandidate
    ? buildDraftAngleFamilyRuntime(state.draftAngleCandidate, geometryPrecisionDecimals)
    : null;
}

function clearDraftAngleCandidate() {
  setDraftAngleCandidateRecord(null);
}

function getDraftAngleCandidateRuntime() {
  return draftAngleCandidateRuntime;
}

function syncDraftAngleFamilyRuntimes() {
  draftAngleFamilyRuntimes.clear();
  for (const familyRecord of state.draftAngleFamilies) {
    draftAngleFamilyRuntimes.set(familyRecord.id, buildDraftAngleFamilyRuntime(familyRecord, geometryPrecisionDecimals));
  }
}

function getDraftAngleFamilyRuntime(familyId) {
  return draftAngleFamilyRuntimes.get(familyId) || null;
}

function getActiveDraftAngleStepCount() {
  if (state.draftAngle.mode === "family" && state.draftAngle.familyId) {
    return getDraftAngleFamilyRuntime(state.draftAngle.familyId)?.record.stepCount || 360;
  }

  if (state.draftAngle.mode === "candidate") {
    return getDraftAngleCandidateRuntime()?.record.stepCount || 360;
  }

  return 360;
}

function getActiveDraftAngleRotation() {
  if (state.draftAngle.mode === "family" && state.draftAngle.familyId) {
    const familyRuntime = getDraftAngleFamilyRuntime(state.draftAngle.familyId);
    if (familyRuntime) {
      return getDraftAngleFamilyEntry(familyRuntime, state.draftAngle.stepIndex);
    }
  }

  if (state.draftAngle.mode === "candidate") {
    const candidateRuntime = getDraftAngleCandidateRuntime();
    if (candidateRuntime) {
      return getDraftAngleFamilyEntry(candidateRuntime, state.draftAngle.stepIndex);
    }
  }

  return createFreeDraftAngleRotation(
    state.draftAngle.baseAngleDeg || 0,
    state.draftAngle.stepIndex || 0,
    geometryPrecisionDecimals
  );
}

function setActiveDraftAngleFamily(familyId, stepIndex = 0) {
  const familyRuntime = getDraftAngleFamilyRuntime(familyId);
  if (!familyRuntime) {
    setActiveDraftAngleFree(0, 0);
    return;
  }

  clearDraftAngleCandidate();
  state.draftAngle = {
    mode: "family",
    familyId,
    stepIndex: normalizeDraftAngleStep(stepIndex, familyRuntime.record.stepCount),
    baseAngleDeg: familyRuntime.record.baseAngleDeg,
  };
}

function setActiveDraftAngleCandidate(baseAngleDeg, stepIndex = 0, existingRecord = null) {
  const candidateRecord =
    existingRecord ||
    createDraftAngleFamilyRecord(draftAngleCandidateFamilyId, baseAngleDeg, "candidate", "Candidate");
  setDraftAngleCandidateRecord(candidateRecord);
  state.draftAngle = {
    mode: "candidate",
    familyId: null,
    stepIndex: normalizeDraftAngleStep(stepIndex, candidateRecord.stepCount),
    baseAngleDeg: candidateRecord.baseAngleDeg,
  };
}

function setActiveDraftAngleFree(baseAngleDeg, stepIndex = 0) {
  clearDraftAngleCandidate();
  state.draftAngle = {
    mode: "free",
    familyId: null,
    stepIndex: normalizeDraftAngleStep(stepIndex),
    baseAngleDeg: quantizeAngleValue(normalizeDegrees360(baseAngleDeg), geometryPrecisionDecimals),
  };
}

function setDraftAngleFromDegrees(angleDeg) {
  const familyMatch = findDraftAngleFamilyMatchByDegrees(
    angleDeg,
    draftAngleFamilyRuntimes.values(),
    geometryPrecisionDecimals
  );
  if (familyMatch) {
    setActiveDraftAngleFamily(familyMatch.familyId, familyMatch.stepIndex);
    return;
  }

  setActiveDraftAngleFree(angleDeg, 0);
}

function findDraftAngleCandidateMatchByDegrees(angleDeg) {
  const candidateRuntime = getDraftAngleCandidateRuntime();
  if (!candidateRuntime) return null;

  const freeRotation = createFreeDraftAngleRotation(angleDeg, 0, geometryPrecisionDecimals);
  const stepIndex = candidateRuntime.signatureToStepIndex.get(freeRotation.signature);
  if (stepIndex === undefined) return null;

  return getDraftAngleFamilyEntry(candidateRuntime, stepIndex);
}

function setDraftAngleFromAlignedDegrees(angleDeg) {
  const familyMatch = findDraftAngleFamilyMatchByDegrees(
    angleDeg,
    draftAngleFamilyRuntimes.values(),
    geometryPrecisionDecimals
  );
  if (familyMatch) {
    setActiveDraftAngleFamily(familyMatch.familyId, familyMatch.stepIndex);
    return;
  }

  const candidateMatch = findDraftAngleCandidateMatchByDegrees(angleDeg);
  if (candidateMatch && state.draftAngleCandidate) {
    setActiveDraftAngleCandidate(state.draftAngleCandidate.baseAngleDeg, candidateMatch.stepIndex, state.draftAngleCandidate);
    return;
  }

  setActiveDraftAngleCandidate(angleDeg, 0);
}

function setDraftAngleFromRadians(angleRad) {
  setDraftAngleFromDegrees((angleRad * 180) / Math.PI);
}

function setDraftAngleFromAlignedRadians(angleRad) {
  setDraftAngleFromAlignedDegrees((angleRad * 180) / Math.PI);
}

function materializeActiveDraftAngleCandidateOnCommit() {
  if (state.draftAngle.mode !== "candidate") return null;

  const candidateRecord = state.draftAngleCandidate;
  if (!candidateRecord) {
    setActiveDraftAngleFree(state.draftAngle.baseAngleDeg || 0, state.draftAngle.stepIndex || 0);
    return null;
  }

  const activeStepIndex = state.draftAngle.stepIndex;
  const activeAngleDeg = getActiveDraftAngleRotation().angleDeg;
  const existingFamilyMatch = findDraftAngleFamilyMatchByDegrees(
    activeAngleDeg,
    draftAngleFamilyRuntimes.values(),
    geometryPrecisionDecimals
  );
  if (existingFamilyMatch) {
    setActiveDraftAngleFamily(existingFamilyMatch.familyId, existingFamilyMatch.stepIndex);
    return existingFamilyMatch;
  }

  const familyRecord = createDraftAngleFamilyRecord(
    `draft-angle-family-${state.nextDraftAngleFamilyId++}`,
    candidateRecord.baseAngleDeg,
    "dynamic"
  );
  state.draftAngleFamilies = [...state.draftAngleFamilies, familyRecord];
  syncDraftAngleFamilyRuntimes();
  setActiveDraftAngleFamily(familyRecord.id, activeStepIndex);
  renderLiveRegistry();
  return familyRecord;
}

syncDraftAngleFamilyRuntimes();

function renderLiveRegistry() {
  console.clear();
  console.table(
    state.draftAngleFamilies.map((familyRecord) => {
      const familyRuntime = getDraftAngleFamilyRuntime(familyRecord.id);
      const baseRotation = familyRuntime ? getDraftAngleFamilyEntry(familyRuntime, 0) : null;
      return {
        id: familyRecord.id,
        kind: familyRecord.kind,
        baseAngleDeg: familyRecord.baseAngleDeg,
        baseVectorDx: baseRotation ? baseRotation.cos : null,
        baseVectorDy: baseRotation ? baseRotation.sin : null,
        stepDegrees: familyRecord.stepDegrees,
        stepCount: familyRecord.stepCount,
      };
    })
  );
}

function updateZoomLabel() {
  zoomLevel.textContent = Math.round(state.camera.zoom * 100) + "%";
}

function formatWorkplaneValue(value) {
  const rounded = Math.round(value * 10) / 10;
  return Math.abs(rounded) <= 1e-9 ? "0" : String(rounded);
}

function formatWorkplaneAngleValue(value) {
  if (Math.abs(value) <= 1e-15) return "0";
  return value.toFixed(15).replace(/\.?0+$/, "");
}

function updateWorkplaneStatus() {
  const draftRotation = getActiveDraftAngleRotation();
  const atWorldOrigin = Math.abs(state.draftOrigin.x) <= 1e-9 && Math.abs(state.draftOrigin.y) <= 1e-9;
  const atWorldAngle = Math.abs(draftRotation.signedAngleDeg) <= 1e-9;
  const planeLabel = atWorldOrigin && atWorldAngle ? "world" : "custom";
  const angleDeg = draftRotation.signedAngleDeg;
  workplaneStatus.textContent = `Plane: ${planeLabel} | Rot: ${formatWorkplaneAngleValue(angleDeg)}deg | Origin: ${formatWorkplaneValue(state.draftOrigin.x)}, ${formatWorkplaneValue(state.draftOrigin.y)}`;
}

function updateCursor() {
  if (state.draggingDraftAlign) {
    canvas.style.cursor = "crosshair";
    return;
  }

  if (state.draggingDraftOrigin) {
    canvas.style.cursor = "grabbing";
    return;
  }

  if (state.panning) {
    canvas.style.cursor = "grab";
    return;
  }

  if (state.spacePressed) {
    canvas.style.cursor = "crosshair";
    return;
  }

  if (state.tool === "select") {
    canvas.style.cursor = "default";
    return;
  }

  canvas.style.cursor = "crosshair";
}

function getLayerById(id) {
  return state.layers.find((layer) => layer.id === id) || null;
}

function getActiveLayer() {
  return getLayerById(state.activeLayerId) || state.layers[0];
}

function getNextLayerColor() {
  return layerPalette[(state.nextLayerId - 1) % layerPalette.length];
}

function syncActiveLayerControls() {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;
  layerFillInput.value = activeLayer.fillColor;
}

function syncDrawSizeInput() {
  if (isStripShapeType()) {
    drawSizeInput.disabled = false;
    drawSizeInput.min = "1";
    drawSizeInput.max = "50";
    drawSizeInput.step = "1";
    drawSizeInput.value = String(getStripCellWidth());
    drawSizeInput.title = "Stroke Rect width in grid cells";
    drawSizeInput.setAttribute("aria-label", "Stroke Rect width in grid cells");
    return;
  }

  if (isSquareBrushShapeType()) {
    drawSizeInput.disabled = false;
    drawSizeInput.min = "1";
    drawSizeInput.max = "50";
    drawSizeInput.step = "1";
    drawSizeInput.value = String(getSquareBrushCellWidth());
    drawSizeInput.title = "Square Brush size in grid cells";
    drawSizeInput.setAttribute("aria-label", "Square Brush size in grid cells");
    return;
  }

  drawSizeInput.disabled = true;
  drawSizeInput.title = "This shape does not use the size control";
  drawSizeInput.setAttribute("aria-label", "Tool size");
}

function isRectangleShapeType(shapeType = state.shapeType) {
  return shapeType === "rect";
}

function isEllipseShapeType(shapeType = state.shapeType) {
  return shapeType === "ellipse";
}

function isBoxSnapShapeType(shapeType = state.shapeType) {
  return isRectangleShapeType(shapeType) || isEllipseShapeType(shapeType);
}

function isStripShapeType(shapeType = state.shapeType) {
  return shapeType === "strip";
}

function snapValueToGrid(value, step = gridCellSize) {
  return Math.round(value / step) * step;
}

function snapValueToGridWithOffset(value, offset = 0, step = gridCellSize) {
  return snapValueToGrid(value - offset, step) + offset;
}

function snapDraftPointToGrid(point) {
  return {
    x: snapValueToGrid(point.x),
    y: snapValueToGrid(point.y),
  };
}

function distanceBetweenPoints(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getStripCellWidth(cellWidth = state.stripCellWidth) {
  return Math.max(1, Math.min(50, Math.round(cellWidth)));
}

function getStripWidthInDraftUnits(cellWidth = state.stripCellWidth) {
  return getStripCellWidth(cellWidth) * gridCellSize;
}

function getStripSnapOffset(cellWidth = state.stripCellWidth) {
  return getStripCellWidth(cellWidth) % 2 === 0 ? 0 : gridCellSize / 2;
}

function clearStripAxisLock() {
  state.stripLockedAxis = null;
  state.stripLockAnchorScreen = null;
}

function resetStripAxisLockAnchor(screenPoint = state.pointerScreen) {
  if (!screenPoint) return;
  state.stripLockAnchorScreen = {
    x: screenPoint.x,
    y: screenPoint.y,
  };
  state.stripLockedAxis = null;
}

function getStripLockedAxis(screenPoint, anchorScreen = state.stripLockAnchorScreen) {
  if (!anchorScreen) return null;

  const dx = screenPoint.x - anchorScreen.x;
  const dy = screenPoint.y - anchorScreen.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const distance = Math.hypot(dx, dy);

  if (distance < squareBrushAxisDecisionDistancePx) return null;
  if (Math.abs(absDx - absDy) < squareBrushAxisDecisionBiasPx) return null;

  return absDx >= absDy ? "x" : "y";
}

function getStripInputPoint(point, shiftKey = false, screenPoint = state.pointerScreen) {
  if (!shiftKey || !state.dragging || !state.draftStart) {
    state.stripLockedAxis = null;
    return { x: point.x, y: point.y };
  }

  if (!state.stripLockAnchorScreen) {
    resetStripAxisLockAnchor(screenPoint);
  }

  if (!state.stripLockedAxis) {
    state.stripLockedAxis = getStripLockedAxis(screenPoint);
  }

  if (!state.stripLockedAxis) {
    return { x: point.x, y: point.y };
  }

  return constrainPointToAxis(point, state.draftStart, state.stripLockedAxis);
}

function getSquareBrushCellWidth(cellWidth = state.drawSize) {
  return Math.max(1, Math.min(50, Math.round(cellWidth)));
}

function getSquareBrushSizeInDraftUnits(cellWidth = state.drawSize) {
  return getSquareBrushCellWidth(cellWidth) * gridCellSize;
}

function getSquareBrushSnapOffset(cellWidth = state.drawSize) {
  return getSquareBrushCellWidth(cellWidth) % 2 === 0 ? 0 : gridCellSize / 2;
}

function snapDraftPointToSquareBrushCenter(point, cellWidth = state.drawSize) {
  const offset = getSquareBrushSnapOffset(cellWidth);
  return {
    x: snapValueToGridWithOffset(point.x, offset),
    y: snapValueToGridWithOffset(point.y, offset),
  };
}

function clearSquareBrushAxisLock() {
  state.squareBrushLockedAxis = null;
  state.squareBrushLockAnchorScreen = null;
  state.squareBrushLockAnchorDraft = null;
}

function resetSquareBrushAxisLockAnchor(screenPoint = state.pointerScreen) {
  if (!screenPoint) return;

  state.squareBrushLockAnchorScreen = {
    x: screenPoint.x,
    y: screenPoint.y,
  };
  state.squareBrushLockAnchorDraft = snapDraftPointToSquareBrushCenter(screenToDraft(screenPoint));
  state.squareBrushLockedAxis = null;
}

function getSquareBrushLockedAxis(screenPoint, anchorScreen = state.squareBrushLockAnchorScreen) {
  if (!anchorScreen) return null;

  const dx = screenPoint.x - anchorScreen.x;
  const dy = screenPoint.y - anchorScreen.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const distance = Math.hypot(dx, dy);

  if (distance < squareBrushAxisDecisionDistancePx) return null;
  if (Math.abs(absDx - absDy) < squareBrushAxisDecisionBiasPx) return null;

  return absDx >= absDy ? "x" : "y";
}

function constrainPointToAxis(point, anchor, axis) {
  if (!anchor || !axis) return { x: point.x, y: point.y };
  if (axis === "x") return { x: point.x, y: anchor.y };
  if (axis === "y") return { x: anchor.x, y: point.y };
  return { x: point.x, y: point.y };
}

function getSquareBrushInputPoint(point, shiftKey = false, screenPoint = state.pointerScreen) {
  if (!shiftKey || !state.dragging) {
    clearSquareBrushAxisLock();
    return snapDraftPointToSquareBrushCenter(point);
  }

  if (!state.squareBrushLockAnchorScreen || !state.squareBrushLockAnchorDraft) {
    resetSquareBrushAxisLockAnchor(screenPoint);
  }

  if (!state.squareBrushLockedAxis) {
    state.squareBrushLockedAxis = getSquareBrushLockedAxis(screenPoint);
  }

  const constrainedPoint = constrainPointToAxis(point, state.squareBrushLockAnchorDraft, state.squareBrushLockedAxis);
  return snapDraftPointToSquareBrushCenter(constrainedPoint);
}

function getStripSnapCandidates(point, cellWidth = state.stripCellWidth) {
  const offset = getStripSnapOffset(cellWidth);
  if (!offset) {
    return {
      horizontal: snapDraftPointToGrid(point),
      vertical: snapDraftPointToGrid(point),
    };
  }

  return {
    horizontal: {
      x: snapValueToGrid(point.x),
      y: snapValueToGridWithOffset(point.y, offset),
    },
    vertical: {
      x: snapValueToGridWithOffset(point.x, offset),
      y: snapValueToGrid(point.y),
    },
  };
}

function getStripPreferredSnapFamily(a, b, cellWidth = state.stripCellWidth) {
  if (!getStripSnapOffset(cellWidth)) return null;
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? "horizontal" : "vertical";
}

function snapDraftPointToStripCenterline(point, preferredFamily = null, cellWidth = state.stripCellWidth) {
  const candidates = getStripSnapCandidates(point, cellWidth);
  if (preferredFamily === "horizontal" || preferredFamily === "vertical") {
    return candidates[preferredFamily];
  }

  const horizontalCandidate = candidates.horizontal;
  const verticalCandidate = candidates.vertical;

  return distanceBetweenPoints(point, horizontalCandidate) <= distanceBetweenPoints(point, verticalCandidate)
    ? horizontalCandidate
    : verticalCandidate;
}

function getSnappedStripSegment(a, b, cellWidth = state.stripCellWidth) {
  const preferredFamily = getStripPreferredSnapFamily(a, b, cellWidth);
  return {
    start: snapDraftPointToStripCenterline(a, preferredFamily, cellWidth),
    end: snapDraftPointToStripCenterline(b, preferredFamily, cellWidth),
    snapFamily: preferredFamily,
  };
}

function getDraftInputPoint(point, shapeType = state.shapeType, shiftKey = false, screenPoint = state.pointerScreen) {
  if (isBoxSnapShapeType(shapeType)) return snapDraftPointToGrid(point);
  if (isStripShapeType(shapeType)) return getStripInputPoint(point, shiftKey, screenPoint);
  if (isSquareBrushShapeType(shapeType)) return getSquareBrushInputPoint(point, shiftKey, screenPoint);
  return { x: point.x, y: point.y };
}

function resolvePointerDraftPoint(rawDraftPoint, shiftKey = false, screenPoint = state.pointerScreen) {
  if (state.spacePressed) {
    return { x: rawDraftPoint.x, y: rawDraftPoint.y };
  }

  return state.tool === "draw" ? getDraftInputPoint(rawDraftPoint, state.shapeType, shiftKey, screenPoint) : rawDraftPoint;
}

function deepCopyGeometry(geometry) {
  return geometry.map((polygon) => polygon.map((ring) => ring.map((point) => [point[0], point[1]])));
}

function quantizeCoordinate(value) {
  return Math.round(value * geometryPrecisionFactor) / geometryPrecisionFactor;
}

function quantizePoint(point) {
  return {
    x: quantizeCoordinate(point.x),
    y: quantizeCoordinate(point.y),
  };
}

function rotatePointWithCoefficients(point, cos, sin) {
  return quantizePoint({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  });
}

function rotatePoint(point, angle) {
  const cos = quantizeCoordinate(Math.cos(angle));
  const sin = quantizeCoordinate(Math.sin(angle));
  return rotatePointWithCoefficients(point, cos, sin);
}

function rotatePointWithRotation(point, rotation) {
  return rotatePointWithCoefficients(point, rotation.cos, rotation.sin);
}

function resetWorkplaneToWorld() {
  cancelDraftAlignDrag();
  state.draggingDraftOrigin = false;
  state.draftOriginDragRotation = null;
  state.draftOrigin = { x: 0, y: 0 };
  setActiveDraftAngleFamily(DEFAULT_DRAFT_ANGLE_FAMILY_ID, 0);
  refreshPointerDerivedState();
  updateWorkplaneStatus();
  updateCursor();
  render();
}

function worldToDraftWithPlane(point, origin, rotation) {
  const translated = {
    x: point.x - origin.x,
    y: point.y - origin.y,
  };
  return quantizePoint({
    x: translated.x * rotation.cos + translated.y * rotation.sin,
    y: translated.y * rotation.cos - translated.x * rotation.sin,
  });
}

function draftToWorldWithPlane(point, origin, rotation) {
  const rotated = rotatePointWithRotation(point, rotation);
  return quantizePoint({
    x: rotated.x + origin.x,
    y: rotated.y + origin.y,
  });
}

function transformGeometry(geometry, transformer) {
  return geometry.map((polygon) =>
    polygon.map((ring) =>
      ring.map((point) => {
        const nextPoint = transformer({ x: point[0], y: point[1] });
        return [nextPoint.x, nextPoint.y];
      })
    )
  );
}

function scaleCoordinateToClipperInt(value) {
  return Math.round(quantizeCoordinate(value) * clipperScaleFactor);
}

function scaleCoordinateFromClipperInt(value) {
  return quantizeCoordinate(Number(value) / clipperScaleFactor);
}

function normalizeRing(ring, quantize = false) {
  if (!Array.isArray(ring)) return null;

  const clean = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    let x = Number(point[0]);
    let y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (quantize) {
      x = quantizeCoordinate(x);
      y = quantizeCoordinate(y);
    }

    const prev = clean[clean.length - 1];
    if (prev && Math.abs(prev[0] - x) <= 1e-9 && Math.abs(prev[1] - y) <= 1e-9) {
      continue;
    }

    clean.push([x, y]);
  }

  if (clean.length > 1) {
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.abs(first[0] - last[0]) <= 1e-9 && Math.abs(first[1] - last[1]) <= 1e-9) {
      clean.pop();
    }
  }

  return clean.length >= 3 ? clean : null;
}

function sanitizeGeometry(geometry, quantize = false) {
  if (!Array.isArray(geometry)) return [];

  const polygons = [];
  for (const polygon of geometry) {
    if (!Array.isArray(polygon)) continue;

    const rings = [];
    for (const ring of polygon) {
      const cleanRing = normalizeRing(ring, quantize);
      if (cleanRing) rings.push(cleanRing);
    }

    if (rings.length) polygons.push(rings);
  }

  return polygons;
}

function orientClipperPath(path, wantsPositiveOrientation) {
  if (!Array.isArray(path) || !path.length) return null;
  return isPositive(path) === wantsPositiveOrientation ? path : [...path].reverse();
}

function ringToClipperPath(ring, wantsPositiveOrientation) {
  const cleanRing = normalizeRing(ring, true);
  if (!cleanRing) return null;

  const path = cleanRing.map((point) => ({
    x: scaleCoordinateToClipperInt(point[0]),
    y: scaleCoordinateToClipperInt(point[1]),
  }));

  return orientClipperPath(path, wantsPositiveOrientation);
}

function toClipperPaths(geometry) {
  const cleanGeometry = sanitizeGeometry(geometry, true);
  const paths = [];

  for (const polygon of cleanGeometry) {
    for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
      const path = ringToClipperPath(polygon[ringIndex], ringIndex === 0);
      if (path) paths.push(path);
    }
  }

  return paths;
}

function clipperPathToRing(path) {
  if (!Array.isArray(path) || !path.length) return null;

  return normalizeRing(path.map((point) => [scaleCoordinateFromClipperInt(point.x), scaleCoordinateFromClipperInt(point.y)]), true);
}

function simplifyGeometryCollinear(geometry) {
  const cleanGeometry = sanitizeGeometry(geometry, true);
  if (!cleanGeometry.length) return [];

  const simplifiedGeometry = [];
  for (const polygon of cleanGeometry) {
    const clipperPaths = [];

    for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
      const clipperPath = ringToClipperPath(polygon[ringIndex], ringIndex === 0);
      if (clipperPath) clipperPaths.push(clipperPath);
    }

    if (!clipperPaths.length) continue;

    const simplifiedPaths = simplifyPaths(clipperPaths, clipperSimplifyCollinearEpsilon, true);
    const simplifiedPolygon = [];

    for (let ringIndex = 0; ringIndex < simplifiedPaths.length; ringIndex += 1) {
      const orientedPath = orientClipperPath(simplifiedPaths[ringIndex], ringIndex === 0);
      const simplifiedRing = clipperPathToRing(orientedPath);
      if (simplifiedRing) simplifiedPolygon.push(simplifiedRing);
    }

    if (simplifiedPolygon.length) simplifiedGeometry.push(simplifiedPolygon);
  }

  return sanitizeGeometry(simplifiedGeometry, true);
}

function fromPolyTree(tree) {
  const polygons = [];

  function visit(node) {
    for (let i = 0; i < node.count; i += 1) {
      const child = node.child(i);
      if (!child) continue;

      if (!child.isHole) {
        const polygon = [];
        const outerPath = orientClipperPath(child.poly, true);
        const outerRing = clipperPathToRing(outerPath);
        if (outerRing) polygon.push(outerRing);

        for (let holeIndex = 0; holeIndex < child.count; holeIndex += 1) {
          const holeNode = child.child(holeIndex);
          if (!holeNode || !holeNode.isHole) continue;

          const holePath = orientClipperPath(holeNode.poly, false);
          const holeRing = clipperPathToRing(holePath);
          if (holeRing) polygon.push(holeRing);
        }

        if (polygon.length) polygons.push(polygon);
      }

      // Islands inside holes re-enter as non-hole descendants and become separate polygons.
      visit(child);
    }
  }

  visit(tree);
  return sanitizeGeometry(polygons, true);
}

function executeClipperBoolean(clipType, subjectGeometry, clipGeometry = null) {
  const subjectPaths = toClipperPaths(subjectGeometry);
  if (!subjectPaths.length) return [];

  const clipPaths = clipGeometry ? toClipperPaths(clipGeometry) : null;
  const tree = new PolyTree64();
  booleanOpWithPolyTree(
    clipType,
    subjectPaths,
    clipPaths && clipPaths.length ? clipPaths : null,
    tree,
    clipperFillRule
  );

  return fromPolyTree(tree);
}

function unionGeometryList(geometries) {
  const subjectGeometry = [];

  for (const geometry of geometries) {
    const cleanGeometry = sanitizeGeometry(geometry, true);
    if (!cleanGeometry.length) continue;
    subjectGeometry.push(...cleanGeometry);
  }

  return executeClipperBoolean(ClipType.Union, subjectGeometry);
}

function differenceGeometry(subjectGeometry, clipGeometry) {
  return executeClipperBoolean(ClipType.Difference, subjectGeometry, clipGeometry);
}

function worldToDraft(point) {
  return worldToDraftWithPlane(point, state.draftOrigin, getActiveDraftAngleRotation());
}

function draftToWorld(point) {
  return draftToWorldWithPlane(point, state.draftOrigin, getActiveDraftAngleRotation());
}

function worldGeometryToDraft(geometry) {
  return transformGeometry(geometry, worldToDraft);
}

function draftGeometryToWorld(geometry) {
  return transformGeometry(geometry, draftToWorld);
}

function forEachRing(geometry, visitor) {
  for (let polygonIndex = 0; polygonIndex < geometry.length; polygonIndex += 1) {
    const polygon = geometry[polygonIndex];
    for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
      visitor(polygon[ringIndex], polygonIndex, ringIndex);
    }
  }
}

function mergeBounds(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function getGeometryBounds(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  forEachRing(geometry, (ring) => {
    for (const point of ring) {
      if (point[0] < minX) minX = point[0];
      if (point[1] < minY) minY = point[1];
      if (point[0] > maxX) maxX = point[0];
      if (point[1] > maxY) maxY = point[1];
    }
  });

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function boundsTouch(a, b, pad = 0) {
  return (
    a.x - pad <= b.x + b.w &&
    a.x + a.w + pad >= b.x &&
    a.y - pad <= b.y + b.h &&
    a.y + a.h + pad >= b.y
  );
}

function traceGeometryPath(targetCtx, geometry) {
  forEachRing(geometry, (ring) => {
    if (!ring.length) return;
    targetCtx.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i += 1) {
      targetCtx.lineTo(ring[i][0], ring[i][1]);
    }
    targetCtx.closePath();
  });
}

function createShapeRecord(layerId, geometry, id = null) {
  const cleanGeometry = sanitizeGeometry(geometry);
  if (!cleanGeometry.length) return null;

  return {
    id: id || "shape-" + state.nextShapeId++,
    layerId,
    geometry: cleanGeometry,
    bounds: getGeometryBounds(cleanGeometry),
  };
}

function cloneShape(shape) {
  return {
    id: shape.id,
    layerId: shape.layerId,
    geometry: deepCopyGeometry(shape.geometry),
    bounds: { ...shape.bounds },
  };
}

function normalizeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

function createRectGeometry(rect) {
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;

  return [
    [
      [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ],
    ],
  ];
}

function createEllipseGeometry(rect) {
  const points = [];
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rx = rect.w / 2;
  const ry = rect.h / 2;

  for (let i = 0; i < ellipseSegments; i += 1) {
    const angle = (i / ellipseSegments) * Math.PI * 2;
    const cos = quantizeCoordinate(Math.cos(angle));
    const sin = quantizeCoordinate(Math.sin(angle));
    points.push([quantizeCoordinate(cx + cos * rx), quantizeCoordinate(cy + sin * ry)]);
  }

  return [[points]];
}

function createStripGeometry(a, b, width) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const safeLen = Math.max(length, 0.00001);
  const nx = -dy / safeLen;
  const ny = dx / safeLen;
  const half = Math.max(1, width / 2);

  return {
    geometry: [
      [
        [
          [a.x + nx * half, a.y + ny * half],
          [a.x - nx * half, a.y - ny * half],
          [b.x - nx * half, b.y - ny * half],
          [b.x + nx * half, b.y + ny * half],
        ],
      ],
    ],
    length,
  };
}

function isSquareBrushShapeType(shapeType = state.shapeType) {
  return shapeType === "square-brush";
}

function createSquareBrushDabGeometry(point, size) {
  const side = getSquareBrushSizeInDraftUnits(size);
  const half = side / 2;
  return createRectGeometry({
    x: point.x - half,
    y: point.y - half,
    w: side,
    h: side,
  });
}

function getSquareBrushCornerPoints(point, size) {
  const side = getSquareBrushSizeInDraftUnits(size);
  const half = side / 2;
  return [
    { x: point.x - half, y: point.y - half },
    { x: point.x + half, y: point.y - half },
    { x: point.x + half, y: point.y + half },
    { x: point.x - half, y: point.y + half },
  ];
}

function crossProduct(origin, a, b) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function createConvexHullGeometry(points) {
  if (points.length < 3) return [];

  const sorted = [...points].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  const unique = [];
  for (const point of sorted) {
    const prev = unique[unique.length - 1];
    if (prev && Math.abs(prev.x - point.x) <= 1e-9 && Math.abs(prev.y - point.y) <= 1e-9) {
      continue;
    }
    unique.push(point);
  }

  if (unique.length < 3) return [];

  const lower = [];
  for (const point of unique) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  if (hull.length < 3) return [];

  return [[hull.map((point) => [point.x, point.y])]];
}

function createSquareBrushSweepSegmentGeometry(a, b, size) {
  if (distanceBetweenPoints(a, b) <= 1e-6) {
    return createSquareBrushDabGeometry(a, size);
  }

  return createConvexHullGeometry([...getSquareBrushCornerPoints(a, size), ...getSquareBrushCornerPoints(b, size)]);
}

function buildSquareBrushStrokeDraftGeometry(points, size) {
  if (!points.length) return [];
  if (points.length === 1) return createSquareBrushDabGeometry(points[0], size);

  const sweeps = [];
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    if (distanceBetweenPoints(start, end) <= 1e-6) continue;
    sweeps.push(createSquareBrushSweepSegmentGeometry(start, end, size));
  }

  if (!sweeps.length) return createSquareBrushDabGeometry(points[0], size);
  return unionGeometryList(sweeps);
}

function cloneDraftPoint(point) {
  return point ? { x: point.x, y: point.y } : null;
}

function setDraftShapeFromGeometry(geometry) {
  const cleanGeometry = sanitizeGeometry(geometry);
  state.draftShape = {
    geometry: cleanGeometry,
    bounds: getGeometryBounds(cleanGeometry),
    small: !cleanGeometry.length,
  };
}

function resetDrawSession() {
  state.draftShape = null;
  state.brushLastPoint = null;
  state.brushPoints = [];
  clearStripAxisLock();
  clearSquareBrushAxisLock();
}

function cancelDrawInteraction() {
  state.dragging = false;
  state.drawOperation = "add";
  resetDrawSession();
}

function cancelSelectionInteraction() {
  state.dragging = false;
  resetSelectionInteraction();
}

function rebuildSquareBrushDraftShape() {
  const draftGeometry = buildSquareBrushStrokeDraftGeometry(state.brushPoints, state.drawSize);
  setDraftShapeFromGeometry(draftGeometryToWorld(draftGeometry));
}

function rememberSquareBrushPoint(point) {
  state.squareBrushMemoryPoint = cloneDraftPoint(point);
}

function startSquareBrushStroke(point, shiftKey = false) {
  const strokePoints = [];
  const rememberedPoint = state.squareBrushMemoryPoint;

  if (shiftKey && rememberedPoint && distanceBetweenPoints(rememberedPoint, point) > 1e-6) {
    strokePoints.push(cloneDraftPoint(rememberedPoint));
  }

  strokePoints.push(cloneDraftPoint(point));
  state.brushPoints = strokePoints;
  state.brushLastPoint = cloneDraftPoint(point);
  rememberSquareBrushPoint(point);
  rebuildSquareBrushDraftShape();
}

function appendSquareBrushPathPoints(point) {
  if (!state.brushLastPoint) {
    startSquareBrushStroke(point);
    return false;
  }

  if (distanceBetweenPoints(point, state.brushLastPoint) <= 1e-6) return false;

  state.brushPoints.push({ x: point.x, y: point.y });
  state.brushLastPoint = { x: point.x, y: point.y };
  rememberSquareBrushPoint(point);
  return true;
}

function extendSquareBrushStroke(point) {
  if (!appendSquareBrushPathPoints(point)) return;
  rebuildSquareBrushDraftShape();
}

function makeDraftShape(a, b) {
  const start = isBoxSnapShapeType() ? snapDraftPointToGrid(a) : a;
  const end = isBoxSnapShapeType() ? snapDraftPointToGrid(b) : b;

  if (isStripShapeType()) {
    const segment = getSnappedStripSegment(a, b);
    const strip = createStripGeometry(segment.start, segment.end, getStripWidthInDraftUnits());
    const geometry = draftGeometryToWorld(strip.geometry);
    return {
      geometry,
      bounds: getGeometryBounds(geometry),
      small: strip.length < 2,
    };
  }

  const rect = normalizeRect(start, end);
  const draftGeometry = state.shapeType === "ellipse" ? createEllipseGeometry(rect) : createRectGeometry(rect);
  const geometry = draftGeometryToWorld(draftGeometry);
  return {
    geometry,
    bounds: getGeometryBounds(geometry),
    small: rect.w < 2 || rect.h < 2,
  };
}

function pointSegmentDistance(px, py, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const lenSq = vx * vx + vy * vy;

  if (!lenSq) {
    return Math.hypot(px - a[0], py - a[1]);
  }

  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / lenSq));
  const qx = a[0] + t * vx;
  const qy = a[1] + t * vy;
  return Math.hypot(px - qx, py - qy);
}

function projectPointToSegment(point, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const lenSq = vx * vx + vy * vy;

  if (!lenSq) {
    return { x: a[0], y: a[1] };
  }

  const t = Math.max(0, Math.min(1, ((point.x - a[0]) * vx + (point.y - a[1]) * vy) / lenSq));
  return {
    x: a[0] + t * vx,
    y: a[1] + t * vy,
  };
}

function cloneSnapTarget(target) {
  if (!target) return null;
  return {
    kind: target.kind,
    world: cloneDraftPoint(target.world),
    distance: target.distance,
  };
}

function createFreeDraftTransformTarget(worldPoint) {
  return {
    kind: "free",
    world: cloneDraftPoint(worldPoint),
    distance: Infinity,
  };
}

function getDraftTransformSnapTarget(worldPoint, maxDistance = draftTransformSnapRadiusPx / state.camera.zoom) {
  if (!worldPoint) return null;

  const cornerMaxDistance = draftTransformCornerSnapRadiusPx / state.camera.zoom;
  const cornerPriorityDistance = draftTransformCornerPriorityRadiusPx / state.camera.zoom;
  let bestCorner = null;
  let bestEdge = null;

  for (let shapeIndex = state.shapes.length - 1; shapeIndex >= 0; shapeIndex -= 1) {
    const shape = state.shapes[shapeIndex];
    const layer = getLayerById(shape.layerId);
    if (!layer || !layer.visible) continue;
    if (!boundsTouch(shape.bounds, { x: worldPoint.x, y: worldPoint.y, w: 0, h: 0 }, maxDistance)) continue;

    forEachRing(shape.geometry, (ring) => {
      for (let i = 0; i < ring.length; i += 1) {
        const corner = ring[i];
        const cornerDistance = Math.hypot(worldPoint.x - corner[0], worldPoint.y - corner[1]);
        if (cornerDistance <= cornerMaxDistance && (!bestCorner || cornerDistance < bestCorner.distance)) {
          bestCorner = {
            kind: "corner",
            world: { x: corner[0], y: corner[1] },
            distance: cornerDistance,
          };
        }

        const next = ring[(i + 1) % ring.length];
        const projection = projectPointToSegment(worldPoint, corner, next);
        const edgeDistance = Math.hypot(worldPoint.x - projection.x, worldPoint.y - projection.y);

        if (edgeDistance <= maxDistance && (!bestEdge || edgeDistance < bestEdge.distance)) {
          bestEdge = {
            kind: "edge",
            world: projection,
            distance: edgeDistance,
          };
        }
      }
    });
  }

  if (bestCorner && bestCorner.distance <= cornerPriorityDistance) return bestCorner;
  if (bestEdge) return bestEdge;
  if (bestCorner) return bestCorner;
  return createFreeDraftTransformTarget(worldPoint);
}

function pointInRing(px, py, ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > py !== yj > py;
    if (!crosses) continue;
    const atX = ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (px < atX) inside = !inside;
  }

  return inside;
}

function pointInShapeFill(shape, x, y) {
  let inside = false;

  forEachRing(shape.geometry, (ring) => {
    if (pointInRing(x, y, ring)) inside = !inside;
  });

  return inside;
}

function distanceToShapeBoundary(shape, x, y) {
  let best = Infinity;

  forEachRing(shape.geometry, (ring) => {
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const distance = pointSegmentDistance(x, y, a, b);
      if (distance < best) best = distance;
    }
  });

  return best;
}

function hitsShape(shape, x, y, radius) {
  if (!boundsTouch(shape.bounds, { x, y, w: 0, h: 0 }, radius)) return false;
  if (pointInShapeFill(shape, x, y)) return true;
  return distanceToShapeBoundary(shape, x, y) <= radius;
}

function pointInRect(point, rect, epsilon = 1e-6) {
  return (
    point.x >= rect.x - epsilon &&
    point.x <= rect.x + rect.w + epsilon &&
    point.y >= rect.y - epsilon &&
    point.y <= rect.y + rect.h + epsilon
  );
}

function rectContainsBounds(rect, bounds, epsilon = 1e-6) {
  return (
    bounds.x >= rect.x - epsilon &&
    bounds.y >= rect.y - epsilon &&
    bounds.x + bounds.w <= rect.x + rect.w + epsilon &&
    bounds.y + bounds.h <= rect.y + rect.h + epsilon
  );
}

function getSelectionBoxRect(startDraft, currentDraft) {
  if (!startDraft || !currentDraft) return null;
  return normalizeRect(startDraft, currentDraft);
}

function getSelectionBoxMode(startDraft, currentDraft) {
  if (!startDraft || !currentDraft) return "window";
  return currentDraft.x < startDraft.x ? "crossing" : "window";
}

function getSelectionBoxCorners(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

function pointOnSegment(point, a, b, epsilon = 1e-6) {
  if (Math.abs(crossProduct(a, b, point)) > epsilon) return false;

  return (
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

function segmentsIntersect(a, b, c, d, epsilon = 1e-6) {
  const abC = crossProduct(a, b, c);
  const abD = crossProduct(a, b, d);
  const cdA = crossProduct(c, d, a);
  const cdB = crossProduct(c, d, b);

  if (Math.abs(abC) <= epsilon && pointOnSegment(c, a, b, epsilon)) return true;
  if (Math.abs(abD) <= epsilon && pointOnSegment(d, a, b, epsilon)) return true;
  if (Math.abs(cdA) <= epsilon && pointOnSegment(a, c, d, epsilon)) return true;
  if (Math.abs(cdB) <= epsilon && pointOnSegment(b, c, d, epsilon)) return true;

  const abStraddles = (abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon);
  const cdStraddles = (cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon);

  return abStraddles && cdStraddles;
}

function segmentTouchesRect(a, b, rect) {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;

  const corners = getSelectionBoxCorners(rect);
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];

  return edges.some(([start, end]) => segmentsIntersect(a, b, start, end));
}

function shapeGeometryIntersectsRect(geometry, rect) {
  if (!geometry.length) return false;

  const corners = getSelectionBoxCorners(rect);
  if (corners.some((corner) => pointInShapeFill({ geometry }, corner.x, corner.y))) return true;

  let hit = false;
  forEachRing(geometry, (ring) => {
    if (hit) return;

    for (let i = 0; i < ring.length; i += 1) {
      const a = { x: ring[i][0], y: ring[i][1] };
      if (pointInRect(a, rect)) {
        hit = true;
        return;
      }

      const next = ring[(i + 1) % ring.length];
      const b = { x: next[0], y: next[1] };
      if (segmentTouchesRect(a, b, rect)) {
        hit = true;
        return;
      }
    }
  });

  return hit;
}

function shapeGeometryFitsRect(geometry, rect) {
  if (!geometry.length) return false;

  let hasPoint = false;
  let fits = true;
  forEachRing(geometry, (ring) => {
    if (!fits) return;

    for (const point of ring) {
      hasPoint = true;
      if (pointInRect({ x: point[0], y: point[1] }, rect)) continue;
      fits = false;
      return;
    }
  });

  return hasPoint && fits;
}

function getShapeIdsInDraftSelectionBox(startDraft, currentDraft) {
  const rect = getSelectionBoxRect(startDraft, currentDraft);
  if (!rect || rect.w <= 1e-6 || rect.h <= 1e-6) return [];

  const selectionMode = getSelectionBoxMode(startDraft, currentDraft);
  const nextShapeIds = [];

  for (const shape of state.shapes) {
    const layer = getLayerById(shape.layerId);
    if (!layer || !layer.visible || layer.locked) continue;

    const draftGeometry = worldGeometryToDraft(shape.geometry);
    const draftBounds = getGeometryBounds(draftGeometry);
    const matches =
      selectionMode === "crossing"
        ? boundsTouch(draftBounds, rect) && shapeGeometryIntersectsRect(draftGeometry, rect)
        : rectContainsBounds(rect, draftBounds) && shapeGeometryFitsRect(draftGeometry, rect);

    if (matches) nextShapeIds.push(shape.id);
  }

  return nextShapeIds;
}

function geometriesOverlap(a, b) {
  return executeClipperBoolean(ClipType.Intersection, a, b).length > 0;
}

function collectSelectedGeometriesByLayer(shapeIds = state.selection.shapeIds) {
  const selectedIds = new Set(shapeIds);
  const geometriesByLayer = {};

  for (const shape of state.shapes) {
    if (!selectedIds.has(shape.id)) continue;
    if (!geometriesByLayer[shape.layerId]) geometriesByLayer[shape.layerId] = [];
    geometriesByLayer[shape.layerId].push(deepCopyGeometry(shape.geometry));
  }

  return geometriesByLayer;
}

function getShapeIdsIntersectingLayerGeometries(geometriesByLayer) {
  const nextShapeIds = [];

  for (const shape of state.shapes) {
    const layerGeometries = geometriesByLayer[shape.layerId];
    if (!layerGeometries) continue;
    if (layerGeometries.some((geometry) => geometriesOverlap(shape.geometry, geometry))) {
      nextShapeIds.push(shape.id);
    }
  }

  return nextShapeIds;
}

function createLayerShapeRecordsFromGeometry(layerId, geometry) {
  const multipolygon = sanitizeGeometry(geometry);
  const nextShapes = [];

  for (const polygon of multipolygon) {
    const shape = createShapeRecord(layerId, [polygon]);
    if (shape) nextShapes.push(shape);
  }

  nextShapes.sort((a, b) => {
    const order = a.bounds.y - b.bounds.y;
    if (order !== 0) return order;
    return a.bounds.x - b.bounds.x;
  });

  return nextShapes;
}

function buildUnionShapes(layerId, sourceShapes) {
  if (!sourceShapes.length) return [];
  const unionGeometry = unionGeometryList(sourceShapes.map((shape) => shape.geometry));
  const simplifiedGeometry = simplifyGeometryCollinear(unionGeometry);
  return createLayerShapeRecordsFromGeometry(layerId, simplifiedGeometry);
}

function replaceLayerShapes(layerId, nextLayerShapes) {
  const otherShapes = state.shapes.filter((shape) => shape.layerId !== layerId);
  state.shapes = [...otherShapes, ...nextLayerShapes];
}

function rebuildLayerShapes(layerId) {
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layerId);
  replaceLayerShapes(layerId, buildUnionShapes(layerId, layerShapes));
}

function insertShapeToLayer(layerId, shape) {
  state.shapes.push(shape);
  rebuildLayerShapes(layerId);
}

function subtractGeometryFromLayer(layerId, subtractionGeometry) {
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layerId);
  if (!layerShapes.length) return;

  const affectsSelection = getSelectedShapes().some((shape) => shape.layerId === layerId);
  const nextGeometry = differenceGeometry(
    unionGeometryList(layerShapes.map((shape) => shape.geometry)),
    subtractionGeometry
  );

  replaceLayerShapes(layerId, createLayerShapeRecordsFromGeometry(layerId, nextGeometry));

  if (affectsSelection) clearSelectionForLayer(layerId);
}

function renderLayersPanel() {
  layersList.innerHTML = "";

  for (let i = state.layers.length - 1; i >= 0; i -= 1) {
    const layer = state.layers[i];
    const row = document.createElement("div");
    row.className = "layer-row" + (layer.id === state.activeLayerId ? " active" : "");
    row.dataset.layerId = layer.id;
    row.innerHTML = `
      <span class="layer-name"><span class="layer-swatch" style="background:${layer.fillColor}"></span>${layer.name}</span>
      <button class="layer-mini ${layer.visible ? "is-on" : ""}" data-layer-action="toggle-visible" data-layer-id="${layer.id}" type="button">${layer.visible ? "ON" : "OFF"}</button>
      <button class="layer-mini ${layer.locked ? "is-on" : ""}" data-layer-action="toggle-lock" data-layer-id="${layer.id}" type="button">${layer.locked ? "LOCK" : "FREE"}</button>
    `;
    layersList.appendChild(row);
  }

  syncActiveLayerControls();
}

function normalizeSelectedShapeIds(shapeIds) {
  const wanted = new Set(shapeIds);
  const nextShapeIds = [];

  for (const shape of state.shapes) {
    if (!wanted.has(shape.id) || nextShapeIds.includes(shape.id)) continue;
    nextShapeIds.push(shape.id);
  }

  return nextShapeIds;
}

function setSelectedShapeIds(shapeIds) {
  state.selection.shapeIds = normalizeSelectedShapeIds(shapeIds);
}

function getToggledShapeIds(baseShapeIds, toggledShapeIds) {
  const nextShapeIds = new Set(baseShapeIds);

  for (const shapeId of toggledShapeIds) {
    if (nextShapeIds.has(shapeId)) {
      nextShapeIds.delete(shapeId);
    } else {
      nextShapeIds.add(shapeId);
    }
  }

  return normalizeSelectedShapeIds([...nextShapeIds]);
}

function getSelectedShapes() {
  const selectedIds = new Set(state.selection.shapeIds);
  return state.shapes.filter((shape) => selectedIds.has(shape.id));
}

function isShapeSelected(shapeId) {
  return state.selection.shapeIds.includes(shapeId);
}

function resetSelectionInteraction() {
  state.selection.startWorld = null;
  state.selection.shapeSnapshots = null;
  state.selection.modified = false;
  state.selection.mode = null;
  state.selection.boxStartDraft = null;
  state.selection.boxCurrentDraft = null;
  state.selection.boxBaseShapeIds = null;
  state.selection.modifierMode = null;
  state.selection.pendingShapeId = null;
  state.selection.pendingScreen = null;
}

function clearSelection() {
  state.selection.shapeIds = [];
  resetSelectionInteraction();
}

function clearSelectionForLayer(layerId) {
  setSelectedShapeIds(getSelectedShapes().filter((shape) => shape.layerId !== layerId).map((shape) => shape.id));
  resetSelectionInteraction();
}

function createSelectionShapeSnapshotMap(shapeIds = state.selection.shapeIds) {
  const selectedIds = new Set(shapeIds);
  const snapshots = {};

  for (const shape of state.shapes) {
    if (!selectedIds.has(shape.id)) continue;
    snapshots[shape.id] = cloneShape(shape);
  }

  return snapshots;
}

function addLayer() {
  const id = "layer-" + state.nextLayerId;
  const name = "Layer " + state.nextLayerId;
  const fillColor = getNextLayerColor();
  state.nextLayerId += 1;
  state.layers.push({ id, name, visible: true, locked: false, fillColor });
  state.activeLayerId = id;
  clearSelection();
  renderLayersPanel();
  render();
}

function deleteActiveLayer() {
  if (state.layers.length <= 1) return;

  const index = state.layers.findIndex((layer) => layer.id === state.activeLayerId);
  if (index < 0) return;

  const deletedId = state.layers[index].id;
  state.layers.splice(index, 1);
  state.shapes = state.shapes.filter((shape) => shape.layerId !== deletedId);
  const fallback = state.layers[Math.max(0, index - 1)] || state.layers[0];
  state.activeLayerId = fallback.id;
  clearSelection();
  renderLayersPanel();
  render();
}

function moveActiveLayer(direction) {
  const index = state.layers.findIndex((layer) => layer.id === state.activeLayerId);
  if (index < 0) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.layers.length) return;

  const [layer] = state.layers.splice(index, 1);
  state.layers.splice(targetIndex, 0, layer);
  renderLayersPanel();
  render();
}

function setTool(tool) {
  const previousTool = state.tool;
  if (previousTool === "draw" && tool !== "draw") cancelDrawInteraction();
  if (previousTool === "select" && tool !== "select") cancelSelectionInteraction();

  state.tool = tool;
  selectBtn.classList.toggle("active", tool === "select");
  drawBtn.classList.toggle("active", tool === "draw");
  updateCursor();
  render();
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!state.camera.x && !state.camera.y) {
    state.camera.x = width / 2;
    state.camera.y = height / 2;
  }

  render();
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function screenToDraft(point) {
  return {
    x: (point.x - state.camera.x) / state.camera.zoom,
    y: (point.y - state.camera.y) / state.camera.zoom,
  };
}

function draftToScreen(point) {
  return {
    x: point.x * state.camera.zoom + state.camera.x,
    y: point.y * state.camera.zoom + state.camera.y,
  };
}

function screenToWorld(point) {
  return draftToWorld(screenToDraft(point));
}

function worldToScreen(point) {
  return draftToScreen(worldToDraft(point));
}

function applyWorldCameraTransform(targetCtx) {
  const draftRotation = getActiveDraftAngleRotation();
  targetCtx.translate(state.camera.x, state.camera.y);
  targetCtx.scale(state.camera.zoom, state.camera.zoom);
  targetCtx.rotate(-draftRotation.angleRad);
  targetCtx.translate(-state.draftOrigin.x, -state.draftOrigin.y);
}

function refreshPointerDerivedState() {
  if (!state.pointerInCanvas || state.dragging || state.draggingDraftOrigin || state.draggingDraftAlign) return;

  const rawDraft = screenToDraft(state.pointerScreen);
  state.draftCurrent = resolvePointerDraftPoint(rawDraft, state.shiftPressed, state.pointerScreen);
  state.current = draftToWorld(state.draftCurrent);
}

function updateDraftOriginFromDrag(screenPoint) {
  const deltaDraft = {
    x: (screenPoint.x - state.draftOriginDragStartScreen.x) / state.camera.zoom,
    y: (screenPoint.y - state.draftOriginDragStartScreen.y) / state.camera.zoom,
  };
  const deltaWorld = rotatePointWithRotation(deltaDraft, state.draftOriginDragRotation || getActiveDraftAngleRotation());

  state.draftOrigin = {
    x: state.draftOriginDragStartOrigin.x - deltaWorld.x,
    y: state.draftOriginDragStartOrigin.y - deltaWorld.y,
  };
  updateWorkplaneStatus();
}

function cancelDraftAlignDrag() {
  state.draggingDraftAlign = false;
  state.draftAlignStartSnap = null;
  state.draftAlignCurrentSnap = null;
}

function applyDraftAlignFromDrag() {
  const startSnap = state.draftAlignStartSnap;
  const endSnap = state.draftAlignCurrentSnap;
  if (!startSnap || !endSnap) return false;
  if (distanceBetweenPoints(startSnap.world, endSnap.world) <= 1e-6) return false;

  state.draftOrigin = cloneDraftPoint(startSnap.world);
  setDraftAngleFromAlignedRadians(Math.atan2(endSnap.world.y - startSnap.world.y, endSnap.world.x - startSnap.world.x));
  updateWorkplaneStatus();
  return true;
}

function zoomAtScreenPoint(nextZoom, screenPoint) {
  const targetZoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));
  if (targetZoom === state.camera.zoom) return;

  const worldPoint = screenToWorld(screenPoint);
  const draftPoint = worldToDraft(worldPoint);
  state.camera.zoom = targetZoom;
  state.camera.x = screenPoint.x - draftPoint.x * targetZoom;
  state.camera.y = screenPoint.y - draftPoint.y * targetZoom;
  updateZoomLabel();
  render();
}

function rotateDraftAngle(stepDelta) {
  if (!Number.isFinite(stepDelta) || !stepDelta) return;
  state.draftAngle.stepIndex = normalizeDraftAngleStep(
    state.draftAngle.stepIndex + Math.trunc(stepDelta),
    getActiveDraftAngleStepCount()
  );
  if (state.draggingDraftOrigin) {
    state.draftOriginDragStartScreen = { x: state.pointerScreen.x, y: state.pointerScreen.y };
    state.draftOriginDragStartOrigin = { x: state.draftOrigin.x, y: state.draftOrigin.y };
    state.draftOriginDragRotation = getActiveDraftAngleRotation();
  }
  refreshPointerDerivedState();
  updateWorkplaneStatus();
  render();
}

function pickSelectableAt(worldPoint) {
  const threshold = 8 / state.camera.zoom;

  for (let layerIndex = state.layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const layer = state.layers[layerIndex];
    if (!layer.visible || layer.locked) continue;

    for (let i = state.shapes.length - 1; i >= 0; i -= 1) {
      const shape = state.shapes[i];
      if (shape.layerId !== layer.id) continue;
      if (!hitsShape(shape, worldPoint.x, worldPoint.y, threshold)) continue;
      return { shapeIndex: i };
    }
  }

  return null;
}

function pickShapeInLayerAt(layerId, worldPoint) {
  const threshold = 8 / state.camera.zoom;

  for (let i = state.shapes.length - 1; i >= 0; i -= 1) {
    const shape = state.shapes[i];
    if (shape.layerId !== layerId) continue;
    if (!hitsShape(shape, worldPoint.x, worldPoint.y, threshold)) continue;
    return shape;
  }

  return null;
}

function moveShapeBy(shape, dx, dy) {
  shape.bounds = {
    x: shape.bounds.x + dx,
    y: shape.bounds.y + dy,
    w: shape.bounds.w,
    h: shape.bounds.h,
  };

  shape.geometry = shape.geometry.map((polygon) =>
    polygon.map((ring) => ring.map((point) => [point[0] + dx, point[1] + dy]))
  );
}

function startSelectionMove(worldPoint) {
  const movableShapeIds = getSelectedShapes()
    .filter((shape) => {
      const layer = getLayerById(shape.layerId);
      return layer && layer.visible && !layer.locked;
    })
    .map((shape) => shape.id);

  setSelectedShapeIds(movableShapeIds);
  state.selection.mode = "move";
  state.selection.startWorld = cloneDraftPoint(worldPoint);
  state.selection.shapeSnapshots = createSelectionShapeSnapshotMap();
  state.selection.modified = false;
  state.selection.boxStartDraft = null;
  state.selection.boxCurrentDraft = null;
  state.selection.boxBaseShapeIds = null;
  state.selection.modifierMode = null;
  state.selection.pendingShapeId = null;
  state.selection.pendingScreen = null;
}

function startSelectionBox(draftPoint, modifierMode = "replace") {
  state.selection.mode = "box";
  state.selection.startWorld = null;
  state.selection.shapeSnapshots = null;
  state.selection.modified = false;
  state.selection.boxStartDraft = cloneDraftPoint(draftPoint);
  state.selection.boxCurrentDraft = cloneDraftPoint(draftPoint);
  state.selection.boxBaseShapeIds = [...state.selection.shapeIds];
  state.selection.modifierMode = modifierMode;
  state.selection.pendingShapeId = null;
  state.selection.pendingScreen = null;
}

function startSelectionTogglePending(shapeId, draftPoint, screenPoint) {
  state.selection.mode = "toggle-pending";
  state.selection.startWorld = null;
  state.selection.shapeSnapshots = null;
  state.selection.modified = false;
  state.selection.boxStartDraft = cloneDraftPoint(draftPoint);
  state.selection.boxCurrentDraft = cloneDraftPoint(draftPoint);
  state.selection.boxBaseShapeIds = [...state.selection.shapeIds];
  state.selection.modifierMode = "toggle";
  state.selection.pendingShapeId = shapeId;
  state.selection.pendingScreen = { x: screenPoint.x, y: screenPoint.y };
}

function hasPendingSelectionDragExceededThreshold(screenPoint) {
  const pendingScreen = state.selection.pendingScreen;
  if (!pendingScreen || !screenPoint) return false;

  return Math.hypot(screenPoint.x - pendingScreen.x, screenPoint.y - pendingScreen.y) >= selectionToggleDragThresholdPx;
}

function updateSelectionBoxSelection(draftPoint) {
  state.selection.boxCurrentDraft = cloneDraftPoint(draftPoint);
  const boxShapeIds = getShapeIdsInDraftSelectionBox(state.selection.boxStartDraft, state.selection.boxCurrentDraft);
  const nextShapeIds =
    state.selection.modifierMode === "toggle"
      ? getToggledShapeIds(state.selection.boxBaseShapeIds || [], boxShapeIds)
      : boxShapeIds;

  setSelectedShapeIds(nextShapeIds);
}

function renderSelectOverlay() {
  if (state.tool !== "select" || !state.selection.shapeIds.length) return;

  const selectedIds = new Set(state.selection.shapeIds);
  let hasVisibleSelection = false;

  ctx.save();
  applyWorldCameraTransform(ctx);
  ctx.beginPath();

  for (const shape of state.shapes) {
    if (!selectedIds.has(shape.id)) continue;

    const selectedLayer = getLayerById(shape.layerId);
    if (!selectedLayer || !selectedLayer.visible) continue;

    traceGeometryPath(ctx, shape.geometry);
    hasVisibleSelection = true;
  }

  if (!hasVisibleSelection) {
    ctx.restore();
    return;
  }

  ctx.strokeStyle = selectionStrokeColor;
  ctx.lineWidth = 2 / state.camera.zoom;
  ctx.stroke();
  ctx.restore();
}

function renderSelectionBoxOverlay() {
  if (state.tool !== "select" || state.selection.mode !== "box") return;

  const rect = getSelectionBoxRect(state.selection.boxStartDraft, state.selection.boxCurrentDraft);
  if (!rect) return;

  const topLeft = draftToScreen({ x: rect.x, y: rect.y });
  const width = rect.w * state.camera.zoom;
  const height = rect.h * state.camera.zoom;
  const selectionMode = getSelectionBoxMode(state.selection.boxStartDraft, state.selection.boxCurrentDraft);

  ctx.save();
  ctx.beginPath();
  ctx.rect(topLeft.x, topLeft.y, width, height);
  ctx.fillStyle = selectionMode === "crossing" ? "rgba(14, 165, 233, 0.14)" : "rgba(14, 165, 233, 0.08)";
  ctx.fill();
  ctx.strokeStyle = selectionStrokeColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(selectionMode === "crossing" ? [8, 4] : []);
  ctx.stroke();
  ctx.restore();
}

function drawLayerPreview(shape, layer, operation = "add") {
  const isSubtract = operation === "subtract";

  ctx.save();
  applyWorldCameraTransform(ctx);
  ctx.beginPath();
  traceGeometryPath(ctx, shape.geometry);
  ctx.fillStyle = isSubtract ? "#ef4444" : layer.fillColor;
  ctx.globalAlpha = isSubtract ? 0.18 : 0.28;
  ctx.fill("evenodd");
  ctx.globalAlpha = 1;
  ctx.strokeStyle = isSubtract ? "#dc2626" : previewStrokeColor;
  ctx.lineWidth = previewStrokeWidth / state.camera.zoom;
  ctx.setLineDash([6 / state.camera.zoom, 6 / state.camera.zoom]);
  ctx.stroke();
  ctx.restore();
}

function drawLayerMerged(layer) {
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layer.id);
  if (!layerShapes.length) return;

  ctx.save();
  applyWorldCameraTransform(ctx);

  for (const shape of layerShapes) {
    ctx.beginPath();
    traceGeometryPath(ctx, shape.geometry);
    ctx.fillStyle = layer.fillColor;
    ctx.fill("evenodd");
    ctx.strokeStyle = outlineStrokeColor;
    ctx.lineWidth = 1 / state.camera.zoom;
    ctx.stroke();
  }

  ctx.restore();
}

function drawGrid() {
  const zoom = state.camera.zoom;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const draftLeft = (0 - state.camera.x) / zoom;
  const draftRight = (width - state.camera.x) / zoom;
  const draftTop = (0 - state.camera.y) / zoom;
  const draftBottom = (height - state.camera.y) / zoom;
  const minorStep = gridCellSize;
  const midStep = minorStep * gridMidCellInterval;
  const majorStep = minorStep * gridMajorCellInterval;
  const epsilon = 1e-9;

  function isAxisCoordinate(value) {
    return Math.abs(value) <= epsilon;
  }

  function drawVerticalLines(step, strokeStyle, shouldSkip = null) {
    ctx.beginPath();
    ctx.strokeStyle = strokeStyle;
    const startX = Math.floor(draftLeft / step) * step;
    for (let x = startX; x <= draftRight; x += step) {
      if (shouldSkip && shouldSkip(x)) continue;
      const sx = draftToScreen({ x, y: 0 }).x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    ctx.stroke();
  }

  function drawHorizontalLines(step, strokeStyle, shouldSkip = null) {
    ctx.beginPath();
    ctx.strokeStyle = strokeStyle;
    const startY = Math.floor(draftTop / step) * step;
    for (let y = startY; y <= draftBottom; y += step) {
      if (shouldSkip && shouldSkip(y)) continue;
      const sy = draftToScreen({ x: 0, y }).y;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();
  }

  function isMidOrMajorCoordinate(value) {
    const cellIndex = Math.round(value / minorStep);
    return cellIndex % 10 === 0;
  }

  function isMajorCoordinate(value) {
    const cellIndex = Math.round(value / minorStep);
    return cellIndex % 20 === 0;
  }

  ctx.save();
  ctx.lineWidth = 1;
  drawVerticalLines(minorStep, "#e9edf3", (x) => isAxisCoordinate(x) || isMidOrMajorCoordinate(x));
  drawHorizontalLines(minorStep, "#e9edf3", (y) => isAxisCoordinate(y) || isMidOrMajorCoordinate(y));
  drawVerticalLines(midStep, "#cfd7e4", (x) => isAxisCoordinate(x) || isMajorCoordinate(x));
  drawHorizontalLines(midStep, "#cfd7e4", (y) => isAxisCoordinate(y) || isMajorCoordinate(y));
  drawVerticalLines(majorStep, "#b2bfd2", isAxisCoordinate);
  drawHorizontalLines(majorStep, "#b2bfd2", isAxisCoordinate);

  ctx.beginPath();
  ctx.strokeStyle = "#475569";
  const originScreenX = draftToScreen({ x: 0, y: 0 }).x;
  const originScreenY = draftToScreen({ x: 0, y: 0 }).y;
  ctx.moveTo(originScreenX, 0);
  ctx.lineTo(originScreenX, height);
  ctx.moveTo(0, originScreenY);
  ctx.lineTo(width, originScreenY);
  ctx.stroke();
  ctx.restore();
}

function drawDraftTransformSnapMarker(target, size = snapPreviewSize + 2) {
  if (!target) return;

  const screenPoint = worldToScreen(target.world);
  const fillStyle = target.kind === "corner" ? "#14b8a6" : target.kind === "edge" ? previewStrokeColor : "#f59e0b";

  ctx.save();
  ctx.translate(screenPoint.x, screenPoint.y);
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;

  if (target.kind === "corner") {
    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 2, 0);
    ctx.lineTo(0, size / 2);
    ctx.lineTo(-size / 2, 0);
    ctx.closePath();
  } else if (target.kind === "edge") {
    ctx.beginPath();
    ctx.rect(-size / 2, -size / 2, size, size);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  }

  ctx.fill();
  ctx.stroke();

  if (target.kind === "free") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(-size / 3, 0);
    ctx.lineTo(size / 3, 0);
    ctx.moveTo(0, -size / 3);
    ctx.lineTo(0, size / 3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDraftAlignStartMarker(point) {
  if (!point) return;

  const screenPoint = worldToScreen(point);
  ctx.save();
  ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screenPoint.x, screenPoint.y, snapPreviewSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDraftTransformPreview() {
  if (!state.spacePressed || !state.pointerInCanvas || state.panning || state.draggingDraftOrigin) return;

  const hoverSnap = state.draggingDraftAlign ? state.draftAlignCurrentSnap : getDraftTransformSnapTarget(state.current);
  const startSnap = state.draggingDraftAlign ? state.draftAlignStartSnap : null;

  if (!hoverSnap && !startSnap) return;

  ctx.save();

  if (startSnap) {
    drawDraftAlignStartMarker(startSnap.world);

    if (hoverSnap && distanceBetweenPoints(startSnap.world, hoverSnap.world) > 1e-6) {
      const startScreen = worldToScreen(startSnap.world);
      const endScreen = worldToScreen(hoverSnap.world);
      ctx.strokeStyle = "rgba(2, 132, 199, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (hoverSnap) {
    drawDraftTransformSnapMarker(hoverSnap, snapPreviewSize + 2);
  }

  ctx.restore();
}

function drawSnapPreview() {
  if (!state.pointerInCanvas || state.panning || state.draggingDraftOrigin || state.spacePressed) return;
  if (state.tool !== "draw") return;

  const activeLayer = getActiveLayer();
  if (!activeLayer || !activeLayer.visible || activeLayer.locked) return;

  let snapPoint = null;
  if (isBoxSnapShapeType()) {
    snapPoint = snapDraftPointToGrid(state.draftCurrent);
  } else if (isStripShapeType()) {
    snapPoint =
      state.dragging && state.draftStart
        ? getSnappedStripSegment(state.draftStart, state.draftCurrent).end
        : snapDraftPointToStripCenterline(state.draftCurrent);
  } else if (isSquareBrushShapeType()) {
    snapPoint = snapDraftPointToSquareBrushCenter(state.draftCurrent);
  }

  if (!snapPoint) return;

  const isSubtract = state.dragging && state.drawOperation === "subtract";
  const screenPoint = draftToScreen(snapPoint);

  if (isSquareBrushShapeType()) {
    const brushSize = getSquareBrushSizeInDraftUnits();
    const half = brushSize / 2;
    const topLeft = draftToScreen({ x: snapPoint.x - half, y: snapPoint.y - half });
    const screenSize = brushSize * state.camera.zoom;

    ctx.save();
    ctx.fillStyle = isSubtract ? "rgba(239, 68, 68, 0.14)" : "rgba(14, 165, 233, 0.14)";
    ctx.strokeStyle = isSubtract ? "#dc2626" : previewStrokeColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.rect(topLeft.x, topLeft.y, screenSize, screenSize);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isSubtract ? "#dc2626" : previewStrokeColor;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.rect(screenPoint.x - snapPreviewSize / 2, screenPoint.y - snapPreviewSize / 2, snapPreviewSize, snapPreviewSize);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  const size = snapPreviewSize;

  ctx.save();
  ctx.fillStyle = isSubtract ? "#dc2626" : previewStrokeColor;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(screenPoint.x - size / 2, screenPoint.y - size / 2, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawGrid();

  for (const layer of state.layers) {
    if (!layer.visible) continue;
    drawLayerMerged(layer);
  }

  const activeLayer = getActiveLayer();
  if (state.dragging && state.tool === "draw" && activeLayer.visible && !activeLayer.locked) {
    const draft = state.draftShape;
    if (draft && !draft.small) drawLayerPreview(draft, activeLayer, state.drawOperation);
  }

  renderSelectOverlay();
  renderSelectionBoxOverlay();
  drawDraftTransformPreview();
  drawSnapPreview();
}

canvas.addEventListener("pointerdown", (e) => {
  const screen = getPos(e);
  state.pointerScreen = { x: screen.x, y: screen.y };
  const rawDraft = screenToDraft(screen);
  const draft = resolvePointerDraftPoint(rawDraft, e.shiftKey, screen);
  const world = draftToWorld(draft);
  state.pointerInCanvas = true;
  state.current = world;
  state.draftCurrent = draft;

  if (state.spacePressed) {
    if (e.button === 0) {
      const startSnap = getDraftTransformSnapTarget(world);
      if (!startSnap) {
        render();
        return;
      }

      state.draggingDraftAlign = true;
      state.draftAlignStartSnap = cloneSnapTarget(startSnap);
      state.draftAlignCurrentSnap = cloneSnapTarget(startSnap);
      updateCursor();
      canvas.setPointerCapture(e.pointerId);
      render();
      return;
    }

    if (e.button === 1 && !state.draggingDraftAlign) {
      state.draggingDraftOrigin = true;
      state.draftOriginDragStartScreen = { x: screen.x, y: screen.y };
      state.draftOriginDragStartOrigin = { x: state.draftOrigin.x, y: state.draftOrigin.y };
      state.draftOriginDragRotation = getActiveDraftAngleRotation();
      updateCursor();
      canvas.setPointerCapture(e.pointerId);
    }
    return;
  }

  const wantsPan = e.button === 1 || (e.button === 2 && state.tool !== "draw");

  if (wantsPan) {
    state.panning = true;
    state.panStart = screen;
    state.panOrigin = { x: state.camera.x, y: state.camera.y };
    updateCursor();
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  if (e.button !== 0 && e.button !== 2) return;

  if (state.tool === "select") {
    if (e.button !== 0) return;

    const pick = pickSelectableAt(world);
    if (e.shiftKey) {
      if (pick) {
        startSelectionTogglePending(state.shapes[pick.shapeIndex].id, draft, screen);
      } else {
        startSelectionBox(draft, "toggle");
      }

      state.dragging = true;
      canvas.setPointerCapture(e.pointerId);
      render();
      return;
    }

    if (!pick) {
      clearSelection();
      startSelectionBox(draft, "replace");
      state.dragging = true;
      canvas.setPointerCapture(e.pointerId);
      render();
      return;
    }

    const pickedShape = state.shapes[pick.shapeIndex];
    if (!isShapeSelected(pickedShape.id)) {
      setSelectedShapeIds([pickedShape.id]);
    }

    startSelectionMove(world);
    state.dragging = true;
    canvas.setPointerCapture(e.pointerId);
    render();
    return;
  }

  const activeLayer = getActiveLayer();
  if (state.tool === "draw" && (!activeLayer.visible || activeLayer.locked)) return;

  state.dragging = true;
  state.start = world;
  state.draftStart = draft;
  state.drawOperation = e.button === 2 ? "subtract" : "add";
  resetDrawSession();

  if (state.tool === "draw") {
    if (isSquareBrushShapeType()) {
      if (e.shiftKey) resetSquareBrushAxisLockAnchor(screen);
      startSquareBrushStroke(draft, e.shiftKey);
      render();
    } else if (isStripShapeType()) {
      resetStripAxisLockAnchor(screen);
      state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
      render();
    } else {
      state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
      render();
    }
  }

  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const screen = getPos(e);
  state.pointerScreen = { x: screen.x, y: screen.y };
  const rawDraft = screenToDraft(screen);
  state.pointerInCanvas = true;
  state.draftCurrent = resolvePointerDraftPoint(rawDraft, e.shiftKey, screen);
  state.current = draftToWorld(state.draftCurrent);

  if (state.panning) {
    state.camera.x = state.panOrigin.x + (screen.x - state.panStart.x);
    state.camera.y = state.panOrigin.y + (screen.y - state.panStart.y);
    render();
    return;
  }

  if (state.draggingDraftAlign) {
    state.draftAlignCurrentSnap = cloneSnapTarget(getDraftTransformSnapTarget(state.current));
    render();
    return;
  }

  if (state.draggingDraftOrigin) {
    updateDraftOriginFromDrag(screen);
    state.current = draftToWorld(state.draftCurrent);
    render();
    return;
  }

  if (!state.dragging) {
    render();
    return;
  }

  if (state.tool === "select") {
    if (state.selection.mode === "toggle-pending") {
      if (hasPendingSelectionDragExceededThreshold(screen)) {
        state.selection.mode = "box";
        updateSelectionBoxSelection(state.draftCurrent);
      }
      render();
      return;
    }

    if (state.selection.mode === "box") {
      updateSelectionBoxSelection(state.draftCurrent);
      render();
      return;
    }

    if (state.selection.mode === "move" && state.selection.shapeSnapshots && state.selection.startWorld) {
      const dx = state.current.x - state.selection.startWorld.x;
      const dy = state.current.y - state.selection.startWorld.y;
      const didChange = Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6;

      state.shapes = state.shapes.map((shape) => {
        const shapeSnapshot = state.selection.shapeSnapshots[shape.id];
        if (!shapeSnapshot) return shape;

        const nextShape = cloneShape(shapeSnapshot);
        moveShapeBy(nextShape, dx, dy);
        return nextShape;
      });

      state.selection.modified = didChange;
    }
    render();
    return;
  }

  if (state.tool === "draw") {
    if (isSquareBrushShapeType()) {
      extendSquareBrushStroke(state.draftCurrent);
    } else {
      state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
    }
  }

  render();
});

function finishDrag(e) {
  if (e && e.type !== "pointerleave") {
    const screen = getPos(e);
    state.pointerScreen = { x: screen.x, y: screen.y };
    const rawDraft = screenToDraft(screen);
    state.draftCurrent = resolvePointerDraftPoint(rawDraft, e.shiftKey, screen);
    state.current = draftToWorld(state.draftCurrent);
  }

  if (state.draggingDraftAlign) {
    const canApply = !e || e.type !== "pointerleave";
    let didApply = false;
    if (canApply) {
      state.draftAlignCurrentSnap = cloneSnapTarget(getDraftTransformSnapTarget(state.current));
      didApply = applyDraftAlignFromDrag();
    }

    cancelDraftAlignDrag();
    if (didApply) refreshPointerDerivedState();
    updateCursor();
    render();
    return;
  }

  if (state.draggingDraftOrigin) {
    state.draggingDraftOrigin = false;
    state.draftOriginDragRotation = null;
    state.current = draftToWorld(state.draftCurrent);
    updateCursor();
    render();
    return;
  }

  if (state.panning) {
    state.panning = false;
    updateCursor();
    render();
    return;
  }

  if (!state.dragging) return;

  if (state.tool === "select") {
    if (state.selection.mode === "toggle-pending") {
      setSelectedShapeIds(
        getToggledShapeIds(state.selection.boxBaseShapeIds || [], state.selection.pendingShapeId ? [state.selection.pendingShapeId] : [])
      );
      resetSelectionInteraction();
      state.dragging = false;
      render();
      return;
    }

    if (state.selection.mode === "box") {
      updateSelectionBoxSelection(state.draftCurrent);
      resetSelectionInteraction();
      state.dragging = false;
      render();
      return;
    }

    const movedGeometriesByLayer = state.selection.modified ? collectSelectedGeometriesByLayer() : null;
    const affectedLayerIds = movedGeometriesByLayer ? Object.keys(movedGeometriesByLayer) : [];

    resetSelectionInteraction();
    state.dragging = false;

    if (affectedLayerIds.length) {
      for (const layerId of affectedLayerIds) {
        rebuildLayerShapes(layerId);
      }

      setSelectedShapeIds(getShapeIdsIntersectingLayerGeometries(movedGeometriesByLayer));
    }

    render();
    return;
  }

  if (state.tool === "draw") {
    if (state.draftShape && !state.draftShape.small) {
      materializeActiveDraftAngleCandidateOnCommit();
      if (state.drawOperation === "subtract") {
        subtractGeometryFromLayer(state.activeLayerId, state.draftShape.geometry);
      } else {
        const shape = createShapeRecord(state.activeLayerId, state.draftShape.geometry);
        if (shape) insertShapeToLayer(state.activeLayerId, shape);
      }
    }
  }

  state.dragging = false;
  state.drawOperation = "add";
  resetDrawSession();
  render();
}

canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointerleave", finishDrag);
canvas.addEventListener("pointerleave", () => {
  state.pointerInCanvas = false;
  render();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (state.spacePressed) {
      if (state.draggingDraftAlign) return;
      rotateDraftAngle(e.deltaY < 0 ? 1 : -1);
      return;
    }

    const screen = getPos(e);
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    zoomAtScreenPoint(state.camera.zoom * delta, screen);
  },
  { passive: false }
);

selectBtn.addEventListener("click", () => setTool("select"));
drawBtn.addEventListener("click", () => setTool("draw"));
zoomInBtn.addEventListener("click", () => {
  zoomAtScreenPoint(state.camera.zoom * 1.15, {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
});
zoomOutBtn.addEventListener("click", () => {
  zoomAtScreenPoint(state.camera.zoom * 0.85, {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
});
shapeSelect.addEventListener("change", (e) => {
  state.shapeType = e.target.value;
  syncDrawSizeInput();
  render();
});

drawSizeInput.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  if (!Number.isFinite(value)) return;

  if (isStripShapeType()) {
    state.stripCellWidth = getStripCellWidth(value);
    drawSizeInput.value = String(state.stripCellWidth);
  } else if (isSquareBrushShapeType()) {
    state.drawSize = getSquareBrushCellWidth(value);
    drawSizeInput.value = String(state.drawSize);
    if (state.pointerInCanvas) {
      state.draftCurrent = getSquareBrushInputPoint(screenToDraft(state.pointerScreen), state.shiftPressed, state.pointerScreen);
    } else {
      state.draftCurrent = snapDraftPointToSquareBrushCenter(state.draftCurrent);
    }
    state.current = draftToWorld(state.draftCurrent);
  } else {
    return;
  }

  if (state.dragging && state.tool === "draw") {
    if (isSquareBrushShapeType()) {
      rebuildSquareBrushDraftShape();
    } else {
      state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
    }
  }

  render();
});

layersList.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-layer-action]");
  if (actionEl) {
    const layerId = actionEl.dataset.layerId;
    const action = actionEl.dataset.layerAction;
    const layer = getLayerById(layerId);
    if (!layer) return;
    if (action === "toggle-visible") layer.visible = !layer.visible;
    if (action === "toggle-lock") layer.locked = !layer.locked;
    renderLayersPanel();
    render();
    return;
  }

  const row = e.target.closest(".layer-row");
  if (!row) return;
  state.activeLayerId = row.dataset.layerId;
  renderLayersPanel();
  render();
});

layerFillInput.addEventListener("input", (e) => {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;
  activeLayer.fillColor = e.target.value;
  renderLayersPanel();
  render();
});

layerAddBtn.addEventListener("click", addLayer);
layerDeleteBtn.addEventListener("click", deleteActiveLayer);
layerUpBtn.addEventListener("click", () => moveActiveLayer(1));
layerDownBtn.addEventListener("click", () => moveActiveLayer(-1));

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.tool === "draw") {
    setTool("select");
    return;
  }

  if (e.key === "Escape" && state.tool === "select" && state.selection.shapeIds.length) {
    clearSelection();
    state.dragging = false;
    updateCursor();
    render();
    return;
  }

  if (e.key === "Shift") {
    state.shiftPressed = true;
    if (!state.spacePressed && state.pointerInCanvas && state.tool === "draw" && (isSquareBrushShapeType() || isStripShapeType())) {
      if (state.dragging && isSquareBrushShapeType()) {
        resetSquareBrushAxisLockAnchor(state.pointerScreen);
      }
      if (state.dragging && isStripShapeType()) {
        state.stripLockedAxis = null;
        state.draftCurrent = getStripInputPoint(screenToDraft(state.pointerScreen), true, state.pointerScreen);
        state.current = draftToWorld(state.draftCurrent);
        state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
      }
      render();
    }
  }
  if (state.spacePressed && e.key.toLowerCase() === "r") {
    e.preventDefault();
    resetWorkplaneToWorld();
    return;
  }
  if (e.key.toLowerCase() === "s") setTool("select");
  if (e.key.toLowerCase() === "d") setTool("draw");
  if (e.code === "Space") {
    e.preventDefault();
    state.spacePressed = true;
    refreshPointerDerivedState();
    updateCursor();
    render();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "Shift") {
    state.shiftPressed = false;
    clearSquareBrushAxisLock();
    if (!state.spacePressed && state.pointerInCanvas && state.tool === "draw" && (isSquareBrushShapeType() || isStripShapeType())) {
      if (state.dragging && isStripShapeType()) {
        state.stripLockedAxis = null;
        state.draftCurrent = getStripInputPoint(screenToDraft(state.pointerScreen), false, state.pointerScreen);
        state.current = draftToWorld(state.draftCurrent);
        state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
      }
      render();
    }
  }
  if (e.code === "Space") {
    cancelDraftAlignDrag();
    state.draggingDraftOrigin = false;
    state.draftOriginDragRotation = null;
    state.spacePressed = false;
    refreshPointerDerivedState();
    updateCursor();
    render();
  }
});

window.addEventListener("resize", resizeCanvas);

updateZoomLabel();
updateWorkplaneStatus();
updateCursor();
renderLayersPanel();
syncDrawSizeInput();
resizeCanvas();

// Debugging Expose
window.state = state;
window.getActiveDraftAngleRotation = getActiveDraftAngleRotation;
window.draftAngleFamilyRuntimes = draftAngleFamilyRuntimes;
window.renderLiveRegistry = renderLiveRegistry;
