const polygonBoolean = window.polygonClipping;

if (!polygonBoolean) {
  throw new Error("polygon-clipping failed to load. Run `npm install` in this project.");
}

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
const debugStatus = document.getElementById("debug-status");
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
  draftOriginDragAngle: 0,
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
  draftAngleBase: 0,
  draftAngleStepOffset: 0,
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
const draftRotationStepDegrees = 1;
const draftRotationStep = (Math.PI / 180) * draftRotationStepDegrees;
const draftRotationStepsPerTurn = Math.round(360 / draftRotationStepDegrees);
const gridCellSize = 24;
const gridMidCellInterval = 10;
const gridMajorCellInterval = 20;
const snapPreviewSize = 8;
const draftTransformSnapRadiusPx = 14;
const draftTransformCornerSnapRadiusPx = 20;
const draftTransformCornerPriorityRadiusPx = 16;
const selectionToggleDragThresholdPx = 5;
const layerPalette = ["#93c5fd", "#86efac", "#fca5a5", "#fde68a", "#c4b5fd", "#fdba74", "#67e8f9"];
const debugLogLimit = 200;
const geometryDebugEpsilon = 1e-6;
const cadDebug = (window.__cadDebug = window.__cadDebug || {});

if (!Array.isArray(cadDebug.log)) cadDebug.log = [];
if (!("__cadDebugLog" in window)) window.__cadDebugLog = cadDebug.log;
if (!("__cadDebugLastBooleanFailure" in window)) window.__cadDebugLastBooleanFailure = null;
if (!("__cadDebugLastUnion" in window)) window.__cadDebugLastUnion = null;
if (!("__cadDebugLastDifference" in window)) window.__cadDebugLastDifference = null;
if (!("__cadDebugLastUnionFocus" in window)) window.__cadDebugLastUnionFocus = null;
if (!("__cadDebugLastBooleanFailureFocus" in window)) window.__cadDebugLastBooleanFailureFocus = null;
if (!("__cadDebugLastUnionPairSnapshot" in window)) window.__cadDebugLastUnionPairSnapshot = null;
if (!("__cadDebugLastBooleanFailurePairSnapshot" in window)) window.__cadDebugLastBooleanFailurePairSnapshot = null;
if (!("__cadDebugLastUnionRegression" in window)) window.__cadDebugLastUnionRegression = null;
if (!("__cadDebugLastBooleanFailureRegression" in window)) window.__cadDebugLastBooleanFailureRegression = null;
if (!("__cadDebugLastUnionNonMerge" in window)) window.__cadDebugLastUnionNonMerge = null;
if (!("__cadDebugLastBooleanNonMerge" in window)) window.__cadDebugLastBooleanNonMerge = null;

function roundDebugNumber(value, precision = 1000) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * precision) / precision;
}

function serializeDebugPoint(point) {
  if (!point) return null;
  if (Array.isArray(point)) {
    return [roundDebugNumber(point[0]), roundDebugNumber(point[1])];
  }

  return {
    x: roundDebugNumber(point.x),
    y: roundDebugNumber(point.y),
  };
}

function serializeDebugPointList(points) {
  if (!Array.isArray(points)) return [];
  return points.map((point) => serializeDebugPoint(point));
}

function serializeDebugBounds(bounds) {
  if (!bounds) return null;
  return {
    x: roundDebugNumber(bounds.x),
    y: roundDebugNumber(bounds.y),
    w: roundDebugNumber(bounds.w),
    h: roundDebugNumber(bounds.h),
  };
}

function cloneDebugValue(value) {
  if (value === undefined) return undefined;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (error) {
      // Fall through to JSON cloning for plain payloads.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return {
      fallbackType: typeof value,
      stringValue: String(value),
    };
  }
}

function storeDebugGlobal(name, value) {
  const nextValue = cloneDebugValue(value);
  window[name] = nextValue;
  return nextValue;
}

function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name || "Error",
    message: error.message || String(error),
    stack: typeof error.stack === "string" ? error.stack.split("\n").slice(0, 8).join("\n") : null,
  };
}

function updateDebugStatus(message, level = "info") {
  if (!debugStatus) return;
  debugStatus.textContent = `Debug: ${message}`;
  debugStatus.dataset.level = level;
}

function pushDebugEntry(stage, message, payload = null, level = "info") {
  const entry = {
    timestamp: new Date().toISOString(),
    stage,
    message,
    level,
    payload: payload ? cloneDebugValue(payload) : null,
  };

  cadDebug.log.push(entry);
  if (cadDebug.log.length > debugLogLimit) {
    cadDebug.log.splice(0, cadDebug.log.length - debugLogLimit);
  }

  cadDebug.lastEntry = entry;
  window.__cadDebugLog = cadDebug.log;

  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](`[cad-debug:${stage}] ${message}`, entry.payload || "");
  updateDebugStatus(`${stage} | ${message}`, level);
  return entry;
}

function summarizeGeometry(geometry) {
  const cleanGeometry = sanitizeGeometry(geometry);
  let ringCount = 0;
  let pointCount = 0;

  forEachRing(cleanGeometry, (ring) => {
    ringCount += 1;
    pointCount += ring.length;
  });

  return {
    polygonCount: cleanGeometry.length,
    ringCount,
    pointCount,
    bounds: cleanGeometry.length ? serializeDebugBounds(getGeometryBounds(cleanGeometry)) : null,
  };
}

function summarizeShape(shape) {
  if (!shape) return null;
  return {
    id: shape.id,
    layerId: shape.layerId,
    bounds: serializeDebugBounds(shape.bounds),
    geometry: summarizeGeometry(shape.geometry),
  };
}

function summarizeGeometryList(geometries) {
  return geometries.map((geometry, index) => ({
    index,
    summary: summarizeGeometry(geometry),
  }));
}

function updateZoomLabel() {
  zoomLevel.textContent = Math.round(state.camera.zoom * 100) + "%";
}

function formatWorkplaneValue(value) {
  const rounded = Math.round(value * 10) / 10;
  return Math.abs(rounded) <= 1e-9 ? "0" : String(rounded);
}

function updateWorkplaneStatus() {
  const draftAngle = getDraftAngle();
  const atWorldOrigin = Math.abs(state.draftOrigin.x) <= 1e-9 && Math.abs(state.draftOrigin.y) <= 1e-9;
  const atWorldAngle = Math.abs(draftAngle) <= 1e-9;
  const planeLabel = atWorldOrigin && atWorldAngle ? "world" : "custom";
  const angleDeg = (draftAngle * 180) / Math.PI;
  workplaneStatus.textContent = `Plane: ${planeLabel} | Rot: ${formatWorkplaneValue(angleDeg)}deg | Origin: ${formatWorkplaneValue(state.draftOrigin.x)}, ${formatWorkplaneValue(state.draftOrigin.y)}`;
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

function rotatePoint(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function normalizeAngle(angle) {
  const fullTurn = Math.PI * 2;
  let nextAngle = angle % fullTurn;
  if (nextAngle <= -Math.PI) nextAngle += fullTurn;
  if (nextAngle > Math.PI) nextAngle -= fullTurn;
  return nextAngle;
}

function normalizeRotationStepOffset(stepOffset) {
  let nextStepOffset = Math.round(stepOffset);
  if (!Number.isFinite(nextStepOffset)) return 0;
  nextStepOffset %= draftRotationStepsPerTurn;
  const halfTurnSteps = draftRotationStepsPerTurn / 2;
  if (nextStepOffset <= -halfTurnSteps) nextStepOffset += draftRotationStepsPerTurn;
  if (nextStepOffset > halfTurnSteps) nextStepOffset -= draftRotationStepsPerTurn;
  return nextStepOffset;
}

function getDraftAngle() {
  return normalizeAngle(state.draftAngleBase + state.draftAngleStepOffset * draftRotationStep);
}

function setDraftAngleBase(angle) {
  state.draftAngleBase = normalizeAngle(angle);
  state.draftAngleStepOffset = 0;
}

function resetWorkplaneToWorld() {
  cancelDraftAlignDrag();
  state.draggingDraftOrigin = false;
  state.draftOrigin = { x: 0, y: 0 };
  setDraftAngleBase(0);
  refreshPointerDerivedState();
  updateWorkplaneStatus();
  updateCursor();
  render();
}

function worldToDraftWithPlane(point, origin, angle) {
  return rotatePoint(
    {
      x: point.x - origin.x,
      y: point.y - origin.y,
    },
    -angle
  );
}

function draftToWorldWithPlane(point, origin, angle) {
  const rotated = rotatePoint(point, angle);
  return {
    x: rotated.x + origin.x,
    y: rotated.y + origin.y,
  };
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

function normalizeRing(ring) {
  if (!Array.isArray(ring)) return null;

  const clean = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

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

function sanitizeGeometry(geometry) {
  if (!Array.isArray(geometry)) return [];

  const polygons = [];
  for (const polygon of geometry) {
    if (!Array.isArray(polygon)) continue;

    const rings = [];
    for (const ring of polygon) {
      const cleanRing = normalizeRing(ring);
      if (cleanRing) rings.push(cleanRing);
    }

    if (rings.length) polygons.push(rings);
  }

  return polygons;
}

function debugPointsEqual(a, b, epsilon = geometryDebugEpsilon) {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
}

function getDebugPointKey(point, precision = 1000000) {
  return `${roundDebugNumber(point[0], precision)},${roundDebugNumber(point[1], precision)}`;
}

function segmentCrossValue(point, start, end) {
  return (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0]);
}

function isPointOnSegmentArray(point, start, end, epsilon = geometryDebugEpsilon) {
  if (Math.abs(segmentCrossValue(point, start, end)) > epsilon) return false;

  return (
    point[0] >= Math.min(start[0], end[0]) - epsilon &&
    point[0] <= Math.max(start[0], end[0]) + epsilon &&
    point[1] >= Math.min(start[1], end[1]) - epsilon &&
    point[1] <= Math.max(start[1], end[1]) + epsilon
  );
}

function isInteriorPointOnSegmentArray(point, start, end, epsilon = geometryDebugEpsilon) {
  return isPointOnSegmentArray(point, start, end, epsilon) && !debugPointsEqual(point, start, epsilon) && !debugPointsEqual(point, end, epsilon);
}

function getSegmentPointParam(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > geometryDebugEpsilon) {
    return (point[0] - start[0]) / dx;
  }

  if (Math.abs(dy) > geometryDebugEpsilon) {
    return (point[1] - start[1]) / dy;
  }

  return 0;
}

function pointFromSegmentScalar(start, end, scalar, axis = "x") {
  const startScalar = axis === "x" ? start[0] : start[1];
  const endScalar = axis === "x" ? end[0] : end[1];
  const delta = endScalar - startScalar;
  const t = Math.abs(delta) <= geometryDebugEpsilon ? 0 : (scalar - startScalar) / delta;
  return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
}

function dedupeDebugPoints(points, epsilon = geometryDebugEpsilon) {
  const unique = [];

  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) continue;
    if (unique.some((candidate) => debugPointsEqual(candidate, point, epsilon))) continue;
    unique.push([point[0], point[1]]);
  }

  return unique;
}

function collectGeometrySegments(geometry) {
  const segments = [];

  forEachRing(geometry, (ring, polygonIndex, ringIndex) => {
    for (let segmentIndex = 0; segmentIndex < ring.length; segmentIndex += 1) {
      segments.push({
        polygonIndex,
        ringIndex,
        segmentIndex,
        start: ring[segmentIndex],
        end: ring[(segmentIndex + 1) % ring.length],
      });
    }
  });

  return segments;
}

function getRingSignedArea(ring) {
  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    area += start[0] * end[1] - end[0] * start[1];
  }

  return area / 2;
}

function getNormalizedSegmentKey(start, end) {
  const a =
    start[0] < end[0] || (Math.abs(start[0] - end[0]) <= geometryDebugEpsilon && start[1] <= end[1]) ? start : end;
  const b = a === start ? end : start;
  return `${roundDebugNumber(a[0], 1000000)},${roundDebugNumber(a[1], 1000000)}|${roundDebugNumber(
    b[0],
    1000000
  )},${roundDebugNumber(b[1], 1000000)}`;
}

function areSegmentIndicesAdjacent(indexA, indexB, ringLength) {
  if (indexA === indexB) return true;
  if ((indexA + 1) % ringLength === indexB) return true;
  if ((indexB + 1) % ringLength === indexA) return true;
  return false;
}

function countRepeatedVertices(ring) {
  const seen = new Set();
  let repeatedCount = 0;

  for (const point of ring) {
    const key = `${roundDebugNumber(point[0], 1000000)},${roundDebugNumber(point[1], 1000000)}`;
    if (seen.has(key)) {
      repeatedCount += 1;
    } else {
      seen.add(key);
    }
  }

  return repeatedCount;
}

function analyzeRingIntegrity(ring) {
  const ringLength = ring.length;
  const area = getRingSignedArea(ring);
  const segmentKeys = new Map();
  const selfIntersections = [];
  const selfOverlaps = [];

  for (let segmentIndex = 0; segmentIndex < ringLength; segmentIndex += 1) {
    const start = ring[segmentIndex];
    const end = ring[(segmentIndex + 1) % ringLength];
    const key = getNormalizedSegmentKey(start, end);
    segmentKeys.set(key, (segmentKeys.get(key) || 0) + 1);
  }

  for (let aIndex = 0; aIndex < ringLength; aIndex += 1) {
    const aStart = ring[aIndex];
    const aEnd = ring[(aIndex + 1) % ringLength];

    for (let bIndex = aIndex + 1; bIndex < ringLength; bIndex += 1) {
      if (areSegmentIndicesAdjacent(aIndex, bIndex, ringLength)) continue;

      const bStart = ring[bIndex];
      const bEnd = ring[(bIndex + 1) % ringLength];

      if (
        segmentsIntersect(
          { x: aStart[0], y: aStart[1] },
          { x: aEnd[0], y: aEnd[1] },
          { x: bStart[0], y: bStart[1] },
          { x: bEnd[0], y: bEnd[1] },
          geometryDebugEpsilon
        )
      ) {
        selfIntersections.push({
          segments: [aIndex, bIndex],
          a: {
            start: serializeDebugPoint(aStart),
            end: serializeDebugPoint(aEnd),
          },
          b: {
            start: serializeDebugPoint(bStart),
            end: serializeDebugPoint(bEnd),
          },
        });
      }

      const overlap = getCollinearSegmentOverlap(
        { start: aStart, end: aEnd },
        { start: bStart, end: bEnd },
        geometryDebugEpsilon
      );

      if (overlap) {
        selfOverlaps.push({
          segments: [aIndex, bIndex],
          overlap: {
            start: serializeDebugPoint(overlap.start),
            end: serializeDebugPoint(overlap.end),
            length: roundDebugNumber(overlap.length),
          },
        });
      }
    }
  }

  return {
    pointCount: ringLength,
    signedArea: roundDebugNumber(area, 1000),
    absoluteArea: roundDebugNumber(Math.abs(area), 1000),
    winding: area < 0 ? "cw" : "ccw",
    repeatedVertexCount: countRepeatedVertices(ring),
    repeatedSegmentCount: [...segmentKeys.values()].filter((count) => count > 1).length,
    selfIntersectionCount: selfIntersections.length,
    selfIntersections: selfIntersections.slice(0, 12),
    selfOverlapCount: selfOverlaps.length,
    selfOverlaps: selfOverlaps.slice(0, 12),
  };
}

function analyzeGeometryIntegrity(geometry) {
  const cleanGeometry = sanitizeGeometry(geometry);
  const polygonDiagnostics = cleanGeometry.map((polygon, polygonIndex) => ({
    polygonIndex,
    ringDiagnostics: polygon.map((ring, ringIndex) => ({
      ringIndex,
      ...analyzeRingIntegrity(ring),
    })),
  }));

  let selfIntersectionCount = 0;
  let selfOverlapCount = 0;
  let repeatedVertexCount = 0;
  let repeatedSegmentCount = 0;

  for (const polygon of polygonDiagnostics) {
    for (const ring of polygon.ringDiagnostics) {
      selfIntersectionCount += ring.selfIntersectionCount;
      selfOverlapCount += ring.selfOverlapCount;
      repeatedVertexCount += ring.repeatedVertexCount;
      repeatedSegmentCount += ring.repeatedSegmentCount;
    }
  }

  return {
    polygonCount: cleanGeometry.length,
    summary: summarizeGeometry(cleanGeometry),
    repeatedVertexCount,
    repeatedSegmentCount,
    selfIntersectionCount,
    selfOverlapCount,
    polygonDiagnostics,
  };
}

function getCollinearSegmentOverlap(segmentA, segmentB, epsilon = geometryDebugEpsilon) {
  const dxA = segmentA.end[0] - segmentA.start[0];
  const dyA = segmentA.end[1] - segmentA.start[1];
  const dxB = segmentB.end[0] - segmentB.start[0];
  const dyB = segmentB.end[1] - segmentB.start[1];

  if (Math.hypot(dxA, dyA) <= epsilon || Math.hypot(dxB, dyB) <= epsilon) return null;
  if (Math.abs(segmentCrossValue(segmentB.start, segmentA.start, segmentA.end)) > epsilon) return null;
  if (Math.abs(segmentCrossValue(segmentB.end, segmentA.start, segmentA.end)) > epsilon) return null;

  const useXAxis = Math.abs(dxA) >= Math.abs(dyA) ? true : Math.abs(dxB) >= Math.abs(dyB);
  const axis = useXAxis ? "x" : "y";
  const aStart = axis === "x" ? segmentA.start[0] : segmentA.start[1];
  const aEnd = axis === "x" ? segmentA.end[0] : segmentA.end[1];
  const bStart = axis === "x" ? segmentB.start[0] : segmentB.start[1];
  const bEnd = axis === "x" ? segmentB.end[0] : segmentB.end[1];
  const overlapStartScalar = Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd));
  const overlapEndScalar = Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd));

  if (overlapEndScalar - overlapStartScalar <= epsilon) return null;

  const overlapStart = pointFromSegmentScalar(segmentA.start, segmentA.end, overlapStartScalar, axis);
  const overlapEnd = pointFromSegmentScalar(segmentA.start, segmentA.end, overlapEndScalar, axis);

  return {
    start: overlapStart,
    end: overlapEnd,
    length: Math.hypot(overlapEnd[0] - overlapStart[0], overlapEnd[1] - overlapStart[1]),
  };
}

function collectCollinearOverlapDiagnostics(geometryA, geometryB, maxHints = 12) {
  const cleanA = sanitizeGeometry(geometryA);
  const cleanB = sanitizeGeometry(geometryB);
  const segmentsA = collectGeometrySegments(cleanA);
  const segmentsB = collectGeometrySegments(cleanB);
  const hints = [];
  const splitPointsA = [];
  const splitPointsB = [];
  let overlapCount = 0;

  for (const segmentA of segmentsA) {
    for (const segmentB of segmentsB) {
      const overlap = getCollinearSegmentOverlap(segmentA, segmentB);
      if (!overlap) continue;

      overlapCount += 1;
      if (hints.length < maxHints) {
        hints.push({
          segmentA: {
            polygonIndex: segmentA.polygonIndex,
            ringIndex: segmentA.ringIndex,
            segmentIndex: segmentA.segmentIndex,
            start: serializeDebugPoint(segmentA.start),
            end: serializeDebugPoint(segmentA.end),
          },
          segmentB: {
            polygonIndex: segmentB.polygonIndex,
            ringIndex: segmentB.ringIndex,
            segmentIndex: segmentB.segmentIndex,
            start: serializeDebugPoint(segmentB.start),
            end: serializeDebugPoint(segmentB.end),
          },
          overlap: {
            start: serializeDebugPoint(overlap.start),
            end: serializeDebugPoint(overlap.end),
            length: roundDebugNumber(overlap.length),
          },
        });
      }

      if (isInteriorPointOnSegmentArray(overlap.start, segmentA.start, segmentA.end)) splitPointsA.push(overlap.start);
      if (isInteriorPointOnSegmentArray(overlap.end, segmentA.start, segmentA.end)) splitPointsA.push(overlap.end);
      if (isInteriorPointOnSegmentArray(overlap.start, segmentB.start, segmentB.end)) splitPointsB.push(overlap.start);
      if (isInteriorPointOnSegmentArray(overlap.end, segmentB.start, segmentB.end)) splitPointsB.push(overlap.end);
    }
  }

  return {
    overlapCount,
    hints,
    splitPointsA: dedupeDebugPoints(splitPointsA),
    splitPointsB: dedupeDebugPoints(splitPointsB),
  };
}

function splitRingAtPoints(ring, splitPoints) {
  if (!splitPoints.length) return ring.map((point) => [point[0], point[1]]);

  const nextRing = [];

  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const segmentPoints = dedupeDebugPoints(
      splitPoints
        .filter((point) => isInteriorPointOnSegmentArray(point, start, end))
        .sort((a, b) => getSegmentPointParam(a, start, end) - getSegmentPointParam(b, start, end))
    );

    if (!nextRing.length || !debugPointsEqual(nextRing[nextRing.length - 1], start)) {
      nextRing.push([start[0], start[1]]);
    }

    for (const point of segmentPoints) {
      if (!debugPointsEqual(nextRing[nextRing.length - 1], point)) {
        nextRing.push([point[0], point[1]]);
      }
    }
  }

  return normalizeRing(nextRing) || ring.map((point) => [point[0], point[1]]);
}

function splitGeometryAtPoints(geometry, splitPoints) {
  const cleanGeometry = sanitizeGeometry(geometry);
  const uniqueSplitPoints = dedupeDebugPoints(splitPoints);
  if (!uniqueSplitPoints.length) return deepCopyGeometry(cleanGeometry);

  return sanitizeGeometry(
    cleanGeometry.map((polygon) => polygon.map((ring) => splitRingAtPoints(ring, uniqueSplitPoints)))
  );
}

function preprocessUnionInputs(geometries) {
  const cleanGeometries = geometries.map((geometry) => sanitizeGeometry(geometry));
  const splitPointsByGeometry = cleanGeometries.map(() => []);
  const overlapHints = [];
  let overlapCount = 0;

  for (let i = 0; i < cleanGeometries.length; i += 1) {
    for (let j = i + 1; j < cleanGeometries.length; j += 1) {
      const analysis = collectCollinearOverlapDiagnostics(cleanGeometries[i], cleanGeometries[j]);
      overlapCount += analysis.overlapCount;
      splitPointsByGeometry[i].push(...analysis.splitPointsA);
      splitPointsByGeometry[j].push(...analysis.splitPointsB);

      for (const hint of analysis.hints) {
        if (overlapHints.length >= 12) break;
        overlapHints.push({
          pair: [i, j],
          ...hint,
        });
      }
    }
  }

  const dedupedSplitPointsByGeometry = splitPointsByGeometry.map((points) => dedupeDebugPoints(points));
  const splitPointCounts = dedupedSplitPointsByGeometry.map((points) => points.length);

  return {
    geometries: cleanGeometries.map((geometry, index) => splitGeometryAtPoints(geometry, dedupedSplitPointsByGeometry[index])),
    didChange: splitPointCounts.some((count) => count > 0),
    splitPointCounts,
    splitPointsByGeometry: dedupedSplitPointsByGeometry,
    overlapCount,
    overlapHints,
  };
}

function preprocessDifferenceInputs(subjectGeometry, clipGeometry) {
  const cleanSubject = sanitizeGeometry(subjectGeometry);
  const cleanClip = sanitizeGeometry(clipGeometry);
  const analysis = collectCollinearOverlapDiagnostics(cleanSubject, cleanClip);

  return {
    subject: splitGeometryAtPoints(cleanSubject, analysis.splitPointsA),
    clip: splitGeometryAtPoints(cleanClip, analysis.splitPointsB),
    didChange: analysis.splitPointsA.length > 0 || analysis.splitPointsB.length > 0,
    splitPointCounts: {
      subject: analysis.splitPointsA.length,
      clip: analysis.splitPointsB.length,
    },
    overlapCount: analysis.overlapCount,
    overlapHints: analysis.hints,
  };
}

function runUnionAttempt(geometries) {
  if (!geometries.length) {
    return {
      ok: true,
      result: [],
      resultSummary: summarizeGeometry([]),
    };
  }

  if (geometries.length === 1) {
    return {
      ok: true,
      result: deepCopyGeometry(geometries[0]),
      resultSummary: summarizeGeometry(geometries[0]),
    };
  }

  try {
    const result = sanitizeGeometry(polygonBoolean.union(geometries[0], ...geometries.slice(1)));
    return {
      ok: true,
      result,
      resultSummary: summarizeGeometry(result),
    };
  } catch (error) {
    return {
      ok: false,
      error: serializeError(error),
    };
  }
}

function runDifferenceAttempt(subjectGeometry, clipGeometry) {
  if (!subjectGeometry.length) {
    return {
      ok: true,
      result: [],
      resultSummary: summarizeGeometry([]),
    };
  }

  if (!clipGeometry.length) {
    return {
      ok: true,
      result: deepCopyGeometry(subjectGeometry),
      resultSummary: summarizeGeometry(subjectGeometry),
    };
  }

  try {
    const result = sanitizeGeometry(polygonBoolean.difference(subjectGeometry, clipGeometry));
    return {
      ok: true,
      result,
      resultSummary: summarizeGeometry(result),
    };
  } catch (error) {
    return {
      ok: false,
      error: serializeError(error),
    };
  }
}

function runIntersectionAttempt(geometryA, geometryB) {
  try {
    const result = sanitizeGeometry(polygonBoolean.intersection(geometryA, geometryB));
    return {
      ok: true,
      result,
      resultSummary: summarizeGeometry(result),
    };
  } catch (error) {
    return {
      ok: false,
      error: serializeError(error),
    };
  }
}

function runXorAttempt(geometries) {
  if (!geometries.length) {
    return {
      ok: true,
      result: [],
      resultSummary: summarizeGeometry([]),
    };
  }

  if (geometries.length === 1) {
    return {
      ok: true,
      result: deepCopyGeometry(geometries[0]),
      resultSummary: summarizeGeometry(geometries[0]),
    };
  }

  try {
    const result = sanitizeGeometry(polygonBoolean.xor(geometries[0], ...geometries.slice(1)));
    return {
      ok: true,
      result,
      resultSummary: summarizeGeometry(result),
    };
  } catch (error) {
    return {
      ok: false,
      error: serializeError(error),
    };
  }
}

function analyzeUnionFailureIsolation(geometries, sourceShapeIds = [], insertedShapeId = null, maxAttempts = 180) {
  const allIndices = geometries.map((_, index) => index);
  const isolation = {
    insertedShapeId: insertedShapeId || null,
    attemptCount: 0,
    maxAttempts,
    truncated: false,
    failurePersistsWithoutInsertedShape: null,
    insertedShapeIndex: null,
    minimalFailingSubsetIndices: allIndices,
    minimalFailingSubsetSize: allIndices.length,
    minimalFailingSubsetSourceShapeIds: allIndices.map((index) => sourceShapeIds[index] || `input-${index}`),
    minimalFailingSubsetSummaries: allIndices.map((index) => ({
      index,
      sourceShapeId: sourceShapeIds[index] || `input-${index}`,
      summary: summarizeGeometry(geometries[index]),
    })),
  };

  const insertedShapeIndex = insertedShapeId ? sourceShapeIds.indexOf(insertedShapeId) : -1;
  isolation.insertedShapeIndex = insertedShapeIndex >= 0 ? insertedShapeIndex : null;

  if (insertedShapeIndex >= 0 && geometries.length > 1) {
    const candidateIndices = allIndices.filter((index) => index !== insertedShapeIndex);
    const withoutInsertedAttempt = runUnionAttempt(candidateIndices.map((index) => geometries[index]));
    isolation.attemptCount += 1;
    isolation.failurePersistsWithoutInsertedShape = !withoutInsertedAttempt.ok;
    isolation.withoutInsertedShape = {
      sourceShapeId: sourceShapeIds[insertedShapeIndex] || insertedShapeId,
      index: insertedShapeIndex,
      outcome: withoutInsertedAttempt.ok ? "success" : "failure",
      resultSummary: withoutInsertedAttempt.ok ? withoutInsertedAttempt.resultSummary : null,
      error: withoutInsertedAttempt.ok ? null : withoutInsertedAttempt.error,
    };
  }

  let activeIndices = [...allIndices];
  let changed = true;

  while (changed && activeIndices.length > 2 && isolation.attemptCount < maxAttempts) {
    changed = false;

    for (let position = 0; position < activeIndices.length; position += 1) {
      if (isolation.attemptCount >= maxAttempts) {
        isolation.truncated = true;
        break;
      }

      const candidateIndices = activeIndices.filter((_, index) => index !== position);
      const attempt = runUnionAttempt(candidateIndices.map((index) => geometries[index]));
      isolation.attemptCount += 1;

      if (!attempt.ok) {
        activeIndices = candidateIndices;
        changed = true;
        break;
      }
    }
  }

  isolation.minimalFailingSubsetIndices = activeIndices;
  isolation.minimalFailingSubsetSize = activeIndices.length;
  isolation.minimalFailingSubsetSourceShapeIds = activeIndices.map((index) => sourceShapeIds[index] || `input-${index}`);
  isolation.minimalFailingSubsetSummaries = activeIndices.map((index) => ({
    index,
    sourceShapeId: sourceShapeIds[index] || `input-${index}`,
    summary: summarizeGeometry(geometries[index]),
  }));

  return isolation;
}

function analyzeUnionFailurePairs(geometries, sourceShapeIds = [], maxPairs = 24) {
  const analysis = [];
  let pairwiseUnionErrorCount = 0;
  let overlappingPairCount = 0;
  let pairCount = 0;

  for (let i = 0; i < geometries.length; i += 1) {
    for (let j = i + 1; j < geometries.length; j += 1) {
      pairCount += 1;

      const overlapInfo = collectCollinearOverlapDiagnostics(geometries[i], geometries[j]);
      if (overlapInfo.overlapCount > 0) {
        overlappingPairCount += 1;
      }

      const attempt = runUnionAttempt([geometries[i], geometries[j]]);
      if (!attempt.ok) {
        pairwiseUnionErrorCount += 1;
      }

      analysis.push({
        pair: [i, j],
        sourceShapeIds: [sourceShapeIds[i] || `input-${i}`, sourceShapeIds[j] || `input-${j}`],
        inputs: [summarizeGeometry(geometries[i]), summarizeGeometry(geometries[j])],
        collinearOverlapCount: overlapInfo.overlapCount,
        collinearOverlapHints: overlapInfo.hints.slice(0, 6),
        pairwiseUnionStatus: attempt.ok ? "ok" : "error",
        pairwiseUnionResult: attempt.ok ? attempt.resultSummary : null,
        pairwiseUnionError: attempt.ok ? null : attempt.error,
      });
    }
  }

  analysis.sort((a, b) => {
    const aErrorScore = a.pairwiseUnionStatus === "error" ? 1 : 0;
    const bErrorScore = b.pairwiseUnionStatus === "error" ? 1 : 0;
    if (aErrorScore !== bErrorScore) return bErrorScore - aErrorScore;
    if (a.collinearOverlapCount !== b.collinearOverlapCount) return b.collinearOverlapCount - a.collinearOverlapCount;
    return a.pair[0] - b.pair[0] || a.pair[1] - b.pair[1];
  });

  return {
    pairCount,
    pairwiseUnionErrorCount,
    overlappingPairCount,
    truncated: pairCount > maxPairs,
    pairs: analysis.slice(0, maxPairs),
  };
}

function getSourceShapeIdForDebug(index, sourceShapeIds = []) {
  return sourceShapeIds[index] || `input-${index}`;
}

function collectDebugGeometryItems(indices, geometries, sourceShapeIds = []) {
  return indices.map((index) => ({
    index,
    sourceShapeId: getSourceShapeIdForDebug(index, sourceShapeIds),
    geometry: deepCopyGeometry(geometries[index]),
    summary: summarizeGeometry(geometries[index]),
    integrity: analyzeGeometryIntegrity(geometries[index]),
  }));
}

function geometryToSvgPathData(geometry) {
  const commands = [];

  forEachRing(geometry, (ring) => {
    if (!ring.length) return;
    commands.push(`M ${ring[0][0]} ${ring[0][1]}`);

    for (let index = 1; index < ring.length; index += 1) {
      commands.push(`L ${ring[index][0]} ${ring[index][1]}`);
    }

    commands.push("Z");
  });

  return commands.join(" ");
}

function buildGeometryDebugSvg(geometryItems) {
  const validItems = geometryItems.filter((item) => item && item.geometry && item.geometry.length);
  if (!validItems.length) return null;

  let bounds = null;
  for (const item of validItems) {
    const itemBounds = getGeometryBounds(item.geometry);
    bounds = bounds ? mergeBounds(bounds, itemBounds) : itemBounds;
  }

  if (!bounds) return null;

  const padding = 8;
  const viewBox = [
    roundDebugNumber(bounds.x - padding, 1000),
    roundDebugNumber(bounds.y - padding, 1000),
    roundDebugNumber(Math.max(bounds.w + padding * 2, 1), 1000),
    roundDebugNumber(Math.max(bounds.h + padding * 2, 1), 1000),
  ].join(" ");
  const fills = ["rgba(239,68,68,0.25)", "rgba(14,165,233,0.25)", "rgba(245,158,11,0.25)", "rgba(34,197,94,0.25)"];
  const strokes = ["#dc2626", "#0284c7", "#f59e0b", "#16a34a"];
  const paths = validItems
    .map((item, index) => {
      const fill = fills[index % fills.length];
      const stroke = strokes[index % strokes.length];
      const pathData = geometryToSvgPathData(item.geometry);
      return `<path d="${pathData}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" fill-rule="evenodd" />`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths}</svg>`;
}

function buildIntegrityDelta(rawItem, processedItem) {
  return {
    sourceShapeId: rawItem.sourceShapeId,
    pointCountDelta: processedItem.summary.pointCount - rawItem.summary.pointCount,
    repeatedVertexDelta: processedItem.integrity.repeatedVertexCount - rawItem.integrity.repeatedVertexCount,
    repeatedSegmentDelta: processedItem.integrity.repeatedSegmentCount - rawItem.integrity.repeatedSegmentCount,
    selfIntersectionDelta: processedItem.integrity.selfIntersectionCount - rawItem.integrity.selfIntersectionCount,
    selfOverlapDelta: processedItem.integrity.selfOverlapCount - rawItem.integrity.selfOverlapCount,
  };
}

function collectSharedGeometryVertices(geometryA, geometryB, maxPoints = 12) {
  const cleanA = sanitizeGeometry(geometryA);
  const cleanB = sanitizeGeometry(geometryB);
  const pointsA = [];
  const pointsB = [];

  forEachRing(cleanA, (ring) => {
    for (const point of ring) pointsA.push(point);
  });

  forEachRing(cleanB, (ring) => {
    for (const point of ring) pointsB.push(point);
  });

  const sharedPoints = [];

  for (const pointA of pointsA) {
    if (!pointsB.some((pointB) => debugPointsEqual(pointA, pointB))) continue;
    if (sharedPoints.some((point) => debugPointsEqual(point, pointA))) continue;
    sharedPoints.push([pointA[0], pointA[1]]);
  }

  return {
    count: sharedPoints.length,
    points: serializeDebugPointList(sharedPoints.slice(0, maxPoints)),
    truncated: sharedPoints.length > maxPoints,
  };
}

function isSimpleExteriorGeometry(geometry) {
  return Array.isArray(geometry) && geometry.length === 1 && Array.isArray(geometry[0]) && geometry[0].length === 1;
}

function areSegmentsReverse(segmentA, segmentB) {
  return debugPointsEqual(segmentA.start, segmentB.end) && debugPointsEqual(segmentA.end, segmentB.start);
}

function tryStitchSharedEdgeUnion(processedGeometries, referenceUnionResult) {
  const cleanGeometries = processedGeometries.map((geometry) => sanitizeGeometry(geometry));

  if (cleanGeometries.length !== 2) {
    return { ok: false, reason: "expected-two-geometries" };
  }

  if (!cleanGeometries.every((geometry) => isSimpleExteriorGeometry(geometry))) {
    return { ok: false, reason: "unsupported-geometry-shape" };
  }

  const collectedSegments = cleanGeometries.flatMap((geometry, geometryIndex) =>
    collectGeometrySegments(geometry).map((segment) => ({
      ...segment,
      geometryIndex,
      start: [segment.start[0], segment.start[1]],
      end: [segment.end[0], segment.end[1]],
    }))
  );

  const segmentsByKey = new Map();
  for (const segment of collectedSegments) {
    const key = getNormalizedSegmentKey(segment.start, segment.end);
    if (!segmentsByKey.has(key)) segmentsByKey.set(key, []);
    segmentsByKey.get(key).push(segment);
  }

  const boundarySegments = [];
  let discardedSharedSegmentCount = 0;

  for (const [key, group] of segmentsByKey.entries()) {
    if (group.length === 1) {
      boundarySegments.push(group[0]);
      continue;
    }

    if (group.length === 2 && areSegmentsReverse(group[0], group[1])) {
      discardedSharedSegmentCount += 1;
      continue;
    }

    return {
      ok: false,
      reason: "ambiguous-segment-group",
      segmentKey: key,
      segmentGroupSize: group.length,
    };
  }

  if (boundarySegments.length < 3) {
    return {
      ok: false,
      reason: "insufficient-boundary-segments",
      boundarySegmentCount: boundarySegments.length,
      discardedSharedSegmentCount,
    };
  }

  const outgoingSegments = new Map();
  const incomingSegments = new Map();

  for (let index = 0; index < boundarySegments.length; index += 1) {
    const segment = boundarySegments[index];
    const startKey = getDebugPointKey(segment.start);
    const endKey = getDebugPointKey(segment.end);
    if (!outgoingSegments.has(startKey)) outgoingSegments.set(startKey, []);
    if (!incomingSegments.has(endKey)) incomingSegments.set(endKey, []);
    outgoingSegments.get(startKey).push(index);
    incomingSegments.get(endKey).push(index);
  }

  const pointKeys = new Set([...outgoingSegments.keys(), ...incomingSegments.keys()]);
  for (const pointKey of pointKeys) {
    const outgoingCount = (outgoingSegments.get(pointKey) || []).length;
    const incomingCount = (incomingSegments.get(pointKey) || []).length;
    if (outgoingCount !== 1 || incomingCount !== 1) {
      return {
        ok: false,
        reason: "ambiguous-vertex-degree",
        vertex: pointKey,
        outgoingCount,
        incomingCount,
      };
    }
  }

  const usedSegmentIndices = new Set();
  const firstSegment = boundarySegments[0];
  const startPoint = [firstSegment.start[0], firstSegment.start[1]];
  const ringPoints = [[startPoint[0], startPoint[1]]];
  let currentPoint = startPoint;

  for (let step = 0; step < boundarySegments.length; step += 1) {
    const nextIndices = outgoingSegments.get(getDebugPointKey(currentPoint)) || [];
    if (nextIndices.length !== 1) {
      return {
        ok: false,
        reason: "missing-next-segment",
        point: serializeDebugPoint(currentPoint),
      };
    }

    const nextSegmentIndex = nextIndices[0];
    if (usedSegmentIndices.has(nextSegmentIndex)) {
      return {
        ok: false,
        reason: "segment-reused-before-closure",
        segmentIndex: nextSegmentIndex,
      };
    }

    usedSegmentIndices.add(nextSegmentIndex);
    const nextSegment = boundarySegments[nextSegmentIndex];
    currentPoint = [nextSegment.end[0], nextSegment.end[1]];
    ringPoints.push([currentPoint[0], currentPoint[1]]);

    if (debugPointsEqual(currentPoint, startPoint)) break;
  }

  if (!debugPointsEqual(currentPoint, startPoint)) {
    return {
      ok: false,
      reason: "ring-did-not-close",
      usedSegmentCount: usedSegmentIndices.size,
      boundarySegmentCount: boundarySegments.length,
    };
  }

  if (usedSegmentIndices.size !== boundarySegments.length) {
    return {
      ok: false,
      reason: "multiple-boundary-loops",
      usedSegmentCount: usedSegmentIndices.size,
      boundarySegmentCount: boundarySegments.length,
    };
  }

  const stitchedRing = normalizeRing(ringPoints);
  if (!stitchedRing) {
    return {
      ok: false,
      reason: "invalid-stitched-ring",
    };
  }

  const stitchedGeometry = sanitizeGeometry([[[...stitchedRing]]]);
  if (stitchedGeometry.length !== 1) {
    return {
      ok: false,
      reason: "invalid-stitched-geometry",
      resultSummary: summarizeGeometry(stitchedGeometry),
    };
  }

  const xorValidation = runXorAttempt([stitchedGeometry, referenceUnionResult]);
  if (!xorValidation.ok || xorValidation.resultSummary.polygonCount > 0) {
    return {
      ok: false,
      reason: "xor-validation-failed",
      xorValidation,
      resultSummary: summarizeGeometry(stitchedGeometry),
    };
  }

  return {
    ok: true,
    geometry: stitchedGeometry,
    resultSummary: summarizeGeometry(stitchedGeometry),
    discardedSharedSegmentCount,
    boundarySegmentCount: boundarySegments.length,
    xorValidation: xorValidation.resultSummary,
  };
}

function classifyUnionNonMergeSnapshot({
  preSplitDidChange,
  rawUnionAttempt,
  processedResultSummary,
  processedIntersectionAttempt,
  processedOverlap,
  processedSharedVertices,
}) {
  if (
    preSplitDidChange &&
    rawUnionAttempt.ok &&
    rawUnionAttempt.resultSummary.polygonCount < processedResultSummary.polygonCount
  ) {
    return "pre-split-topology-regression";
  }

  if (!processedIntersectionAttempt.ok) return "intersection-check-error";
  if (processedIntersectionAttempt.resultSummary.polygonCount > 0) return "area-overlap-with-multipolygon-result";
  if (processedOverlap.overlapCount > 0) return "shared-collinear-edge-without-merge";
  if (processedSharedVertices.count === 1) return "corner-touch-only";
  if (processedSharedVertices.count > 1) return "shared-vertices-without-area-overlap";
  return "gap-or-disjoint";
}

function buildUnionNonMergeSnapshot(payload) {
  const sourceShapeIds = Array.isArray(payload?.context?.sourceShapeIds) ? payload.context.sourceShapeIds : [];
  const rawInputs = Array.isArray(payload?.inputs) ? payload.inputs : [];
  const processedInputs = Array.isArray(payload?.preSplit?.processedInputs) ? payload.preSplit.processedInputs : rawInputs;

  if (rawInputs.length !== 2 || processedInputs.length !== 2) return null;

  const rawPair = collectDebugGeometryItems([0, 1], rawInputs, sourceShapeIds);
  const processedPair = collectDebugGeometryItems([0, 1], processedInputs, sourceShapeIds);
  const rawOverlap = collectCollinearOverlapDiagnostics(rawInputs[0], rawInputs[1]);
  const processedOverlap = collectCollinearOverlapDiagnostics(processedInputs[0], processedInputs[1]);
  const rawUnionAttempt = runUnionAttempt(rawInputs);
  const rawIntersectionAttempt = runIntersectionAttempt(rawInputs[0], rawInputs[1]);
  const processedIntersectionAttempt = runIntersectionAttempt(processedInputs[0], processedInputs[1]);
  const rawSharedVertices = collectSharedGeometryVertices(rawInputs[0], rawInputs[1]);
  const processedSharedVertices = collectSharedGeometryVertices(processedInputs[0], processedInputs[1]);
  const processedResultSummary = payload?.resultSummary || summarizeGeometry(payload?.result || []);
  const diagnosis = classifyUnionNonMergeSnapshot({
    preSplitDidChange: !!payload?.preSplit?.didChange,
    rawUnionAttempt,
    processedResultSummary,
    processedIntersectionAttempt,
    processedOverlap,
    processedSharedVertices,
  });

  return {
    diagnosis,
    sourceShapeIds: [getSourceShapeIdForDebug(0, sourceShapeIds), getSourceShapeIdForDebug(1, sourceShapeIds)],
    preSplitDidChange: !!payload?.preSplit?.didChange,
    resultSummary: processedResultSummary,
    rawPair,
    processedPair,
    rawUnionAttempt,
    rawIntersectionAttempt,
    processedIntersectionAttempt,
    rawOverlap: {
      overlapCount: rawOverlap.overlapCount,
      hints: rawOverlap.hints,
    },
    processedOverlap: {
      overlapCount: processedOverlap.overlapCount,
      hints: processedOverlap.hints,
    },
    rawSharedVertices,
    processedSharedVertices,
    isSuspicious:
      diagnosis === "pre-split-topology-regression" ||
      diagnosis === "shared-collinear-edge-without-merge" ||
      diagnosis === "area-overlap-with-multipolygon-result",
    rawSvg: buildGeometryDebugSvg(rawPair),
    processedSvg: buildGeometryDebugSvg(processedPair),
  };
}

function buildUnionFailurePairSnapshot(payload) {
  const sourceShapeIds = Array.isArray(payload?.context?.sourceShapeIds) ? payload.context.sourceShapeIds : [];
  const pairIndices = payload?.focus?.topPairwiseError?.pair;
  const rawInputs = Array.isArray(payload?.inputs) ? payload.inputs : [];
  const processedInputs = Array.isArray(payload?.preSplit?.processedInputs) ? payload.preSplit.processedInputs : rawInputs;

  if (!Array.isArray(pairIndices) || pairIndices.length !== 2) return null;
  if (pairIndices.some((index) => index < 0 || index >= processedInputs.length)) return null;

  const rawPair = collectDebugGeometryItems(pairIndices, rawInputs, sourceShapeIds);
  const processedPair = collectDebugGeometryItems(pairIndices, processedInputs, sourceShapeIds);
  const rawOverlap = collectCollinearOverlapDiagnostics(rawInputs[pairIndices[0]], rawInputs[pairIndices[1]]);
  const processedOverlap = collectCollinearOverlapDiagnostics(processedInputs[pairIndices[0]], processedInputs[pairIndices[1]]);
  const rawUnionAttempt = runUnionAttempt([rawInputs[pairIndices[0]], rawInputs[pairIndices[1]]]);
  const processedUnionAttempt = runUnionAttempt([processedInputs[pairIndices[0]], processedInputs[pairIndices[1]]]);
  const pairOnlyPreprocess = preprocessUnionInputs([rawInputs[pairIndices[0]], rawInputs[pairIndices[1]]]);
  const pairOnlyProcessed = collectDebugGeometryItems([0, 1], pairOnlyPreprocess.geometries, [
    getSourceShapeIdForDebug(pairIndices[0], sourceShapeIds),
    getSourceShapeIdForDebug(pairIndices[1], sourceShapeIds),
  ]);
  const pairOnlyProcessedUnionAttempt = runUnionAttempt(pairOnlyPreprocess.geometries);
  const fullSplitPoints = Array.isArray(payload?.preSplit?.splitPointsByInput) ? payload.preSplit.splitPointsByInput : [];
  const integrityDelta = rawPair.map((item, index) => buildIntegrityDelta(item, processedPair[index]));
  const regression = {
    isPreSplitRegression: rawUnionAttempt.ok && !processedUnionAttempt.ok,
    rawUnionSucceeded: rawUnionAttempt.ok,
    processedUnionSucceeded: processedUnionAttempt.ok,
    pairOnlyProcessedUnionSucceeded: pairOnlyProcessedUnionAttempt.ok,
    fullPreprocessSplitPointCounts: pairIndices.map((index) => payload?.preSplit?.splitPointCounts?.[index] || 0),
    fullPreprocessSplitPoints: pairIndices.map((index) => fullSplitPoints[index] || []),
    pairOnlySplitPointCounts: pairOnlyPreprocess.splitPointCounts,
    pairOnlySplitPoints: pairOnlyPreprocess.splitPointsByGeometry.map((points) => serializeDebugPointList(points)),
    integrityDelta,
  };

  return {
    pairIndices,
    sourceShapeIds: pairIndices.map((index) => getSourceShapeIdForDebug(index, sourceShapeIds)),
    rawPair,
    processedPair,
    pairOnlyProcessed,
    rawOverlap: {
      overlapCount: rawOverlap.overlapCount,
      hints: rawOverlap.hints,
    },
    processedOverlap: {
      overlapCount: processedOverlap.overlapCount,
      hints: processedOverlap.hints,
    },
    rawUnionAttempt,
    processedUnionAttempt,
    pairOnlyProcessedUnionAttempt,
    regression,
    rawSvg: buildGeometryDebugSvg(rawPair),
    processedSvg: buildGeometryDebugSvg(processedPair),
    pairOnlyProcessedSvg: buildGeometryDebugSvg(pairOnlyProcessed),
  };
}

function buildUnionFailureFocus(payload) {
  const sourceShapeIds = Array.isArray(payload?.context?.sourceShapeIds) ? payload.context.sourceShapeIds : [];
  const allGeometries = Array.isArray(payload?.preSplit?.processedInputs) ? payload.preSplit.processedInputs : payload.inputs || [];
  const failureIsolation = payload?.failureIsolation || null;
  const pairwiseAnalysis = payload?.pairwiseAnalysis || null;
  const topPairwiseError = pairwiseAnalysis?.pairs?.find((pair) => pair.pairwiseUnionStatus === "error") || null;
  const minimalSubsetIndices = Array.isArray(failureIsolation?.minimalFailingSubsetIndices)
    ? failureIsolation.minimalFailingSubsetIndices
    : allGeometries.map((_, index) => index);
  const focusShapeIds = topPairwiseError?.sourceShapeIds || failureIsolation?.minimalFailingSubsetSourceShapeIds || [];

  let diagnosis = "needs-deeper-analysis";
  if (topPairwiseError) {
    diagnosis = "pairwise-union-error";
  } else if (failureIsolation?.failurePersistsWithoutInsertedShape) {
    diagnosis = "existing-layer-state";
  } else if (failureIsolation && failureIsolation.failurePersistsWithoutInsertedShape === false) {
    diagnosis = "inserted-shape-interaction";
  }

  const focus = {
    diagnosis,
    insertedShapeId: payload?.context?.insertedShapeId || null,
    layerId: payload?.context?.layerId || null,
    sourceShapeCount: payload?.context?.sourceShapeCount || payload?.inputCount || allGeometries.length,
    preSplitDidChange: !!payload?.preSplit?.didChange,
    preSplitOverlapCount: payload?.preSplit?.overlapCount || 0,
    pairwiseUnionErrorCount: pairwiseAnalysis?.pairwiseUnionErrorCount || 0,
    overlappingPairCount: pairwiseAnalysis?.overlappingPairCount || 0,
    failurePersistsWithoutInsertedShape: failureIsolation?.failurePersistsWithoutInsertedShape ?? null,
    minimalFailingSubsetSize: failureIsolation?.minimalFailingSubsetSize || minimalSubsetIndices.length,
    minimalFailingSubsetSourceShapeIds:
      failureIsolation?.minimalFailingSubsetSourceShapeIds ||
      minimalSubsetIndices.map((index) => getSourceShapeIdForDebug(index, sourceShapeIds)),
    topPairwiseError,
    topPairwiseErrorOverlapHints: topPairwiseError?.collinearOverlapHints || [],
    focusShapeIds,
    focusGeometry:
      topPairwiseError && Array.isArray(topPairwiseError.pair)
        ? collectDebugGeometryItems(topPairwiseError.pair, allGeometries, sourceShapeIds)
        : collectDebugGeometryItems(minimalSubsetIndices, allGeometries, sourceShapeIds),
    minimalFailingSubsetGeometry: collectDebugGeometryItems(minimalSubsetIndices, allGeometries, sourceShapeIds),
  };

  focus.summary = topPairwiseError
    ? `pairwise union failure: ${focusShapeIds.join(" + ")}`
    : `minimal failing subset (${focus.minimalFailingSubsetSize}): ${focus.minimalFailingSubsetSourceShapeIds.join(", ")}`;

  return focus;
}

function unionGeometryList(geometries, context = {}) {
  const cleanGeometries = [];

  for (const geometry of geometries) {
    const cleanGeometry = sanitizeGeometry(geometry);
    if (cleanGeometry.length) cleanGeometries.push(cleanGeometry);
  }

  const payload = {
    operation: "union",
    timestamp: new Date().toISOString(),
    context: cloneDebugValue(context),
    inputCount: cleanGeometries.length,
    inputs: cleanGeometries.map((geometry) => deepCopyGeometry(geometry)),
    inputSummaries: summarizeGeometryList(cleanGeometries),
  };

  if (!cleanGeometries.length) {
    payload.shortCircuit = "empty";
    payload.result = [];
    payload.resultSummary = summarizeGeometry([]);
    storeDebugGlobal("__cadDebugLastUnion", payload);
    storeDebugGlobal("__cadDebugLastUnionFocus", null);
    storeDebugGlobal("__cadDebugLastUnionPairSnapshot", null);
    storeDebugGlobal("__cadDebugLastUnionRegression", null);
    storeDebugGlobal("__cadDebugLastUnionNonMerge", null);
    storeDebugGlobal("__cadDebugLastBooleanNonMerge", null);
    pushDebugEntry("boolean.union", "empty input list", payload);
    return [];
  }

  if (cleanGeometries.length === 1) {
    const result = deepCopyGeometry(cleanGeometries[0]);
    payload.shortCircuit = "single";
    payload.result = result;
    payload.resultSummary = summarizeGeometry(result);
    storeDebugGlobal("__cadDebugLastUnion", payload);
    storeDebugGlobal("__cadDebugLastUnionFocus", null);
    storeDebugGlobal("__cadDebugLastUnionPairSnapshot", null);
    storeDebugGlobal("__cadDebugLastUnionRegression", null);
    storeDebugGlobal("__cadDebugLastUnionNonMerge", null);
    storeDebugGlobal("__cadDebugLastBooleanNonMerge", null);
    pushDebugEntry("boolean.union", "single input passthrough", {
      context,
      inputSummary: payload.inputSummaries[0],
      resultSummary: payload.resultSummary,
    });
    return result;
  }

  const preprocessed = preprocessUnionInputs(cleanGeometries);
  payload.preSplit = {
    didChange: preprocessed.didChange,
    splitPointCounts: preprocessed.splitPointCounts,
    splitPointsByInput: preprocessed.splitPointsByGeometry.map((points) => serializeDebugPointList(points)),
    overlapCount: preprocessed.overlapCount,
    overlapHints: preprocessed.overlapHints,
    processedInputs: preprocessed.geometries.map((geometry) => deepCopyGeometry(geometry)),
    processedInputSummaries: summarizeGeometryList(preprocessed.geometries),
  };

  pushDebugEntry("boolean.union", "start", {
    context,
    inputCount: payload.inputCount,
    inputSummaries: payload.inputSummaries,
    preSplit: {
      didChange: payload.preSplit.didChange,
      splitPointCounts: payload.preSplit.splitPointCounts,
      overlapCount: payload.preSplit.overlapCount,
    },
  });

  try {
    const result = sanitizeGeometry(polygonBoolean.union(preprocessed.geometries[0], ...preprocessed.geometries.slice(1)));
    payload.result = deepCopyGeometry(result);
    payload.resultSummary = summarizeGeometry(result);
    payload.nonMerge =
      cleanGeometries.length === 2 && payload.resultSummary.polygonCount > 1 ? buildUnionNonMergeSnapshot(payload) : null;
    if (payload.nonMerge?.diagnosis === "shared-collinear-edge-without-merge") {
      payload.nonMerge.stitchAttempt = tryStitchSharedEdgeUnion(preprocessed.geometries, result);
      if (payload.nonMerge.stitchAttempt.ok) {
        payload.result = deepCopyGeometry(payload.nonMerge.stitchAttempt.geometry);
        payload.resultSummary = payload.nonMerge.stitchAttempt.resultSummary;
        payload.nonMerge.recoveredByStitch = true;
        payload.nonMerge.stitchedResultSummary = payload.resultSummary;
      }
    }
    storeDebugGlobal("__cadDebugLastUnion", payload);
    storeDebugGlobal("__cadDebugLastUnionFocus", null);
    storeDebugGlobal("__cadDebugLastUnionPairSnapshot", null);
    storeDebugGlobal("__cadDebugLastUnionRegression", null);
    storeDebugGlobal("__cadDebugLastUnionNonMerge", payload.nonMerge);
    storeDebugGlobal("__cadDebugLastBooleanNonMerge", payload.nonMerge);
    pushDebugEntry("boolean.union", "success", {
      context,
      inputCount: payload.inputCount,
      resultSummary: payload.resultSummary,
      preSplit: {
        didChange: payload.preSplit.didChange,
        splitPointCounts: payload.preSplit.splitPointCounts,
        overlapCount: payload.preSplit.overlapCount,
      },
    });
    if (payload.nonMerge) {
      pushDebugEntry(
        "boolean.union.nonmerge",
        `${payload.nonMerge.diagnosis}: ${payload.nonMerge.sourceShapeIds.join(" + ")}`,
        payload.nonMerge,
        payload.nonMerge.isSuspicious ? "warn" : "info"
      );
      if (payload.nonMerge.recoveredByStitch) {
        pushDebugEntry(
          "boolean.union.stitch",
          `shared-edge stitch recovered merge: ${payload.nonMerge.sourceShapeIds.join(" + ")}`,
          {
            diagnosis: payload.nonMerge.diagnosis,
            sourceShapeIds: payload.nonMerge.sourceShapeIds,
            stitchAttempt: payload.nonMerge.stitchAttempt,
            resultSummary: payload.resultSummary,
          },
          "warn"
        );
      }
    }
    return deepCopyGeometry(payload.result);
  } catch (error) {
    payload.error = serializeError(error);
    payload.failureIsolation = analyzeUnionFailureIsolation(
      preprocessed.geometries,
      Array.isArray(context.sourceShapeIds) ? context.sourceShapeIds : [],
      context.insertedShapeId || null
    );
    payload.pairwiseAnalysis = analyzeUnionFailurePairs(
      preprocessed.geometries,
      Array.isArray(context.sourceShapeIds) ? context.sourceShapeIds : []
    );
    payload.focus = buildUnionFailureFocus(payload);
    payload.pairSnapshot = buildUnionFailurePairSnapshot(payload);
    if (preprocessed.didChange) {
      const rawAttempt = runUnionAttempt(cleanGeometries);
      payload.fallback = {
        kind: "raw-after-pre-split-failure",
        rawSucceeded: rawAttempt.ok,
        processedError: payload.error,
        rawError: rawAttempt.ok ? null : rawAttempt.error,
        rawResultSummary: rawAttempt.ok ? rawAttempt.resultSummary : null,
      };
      if (rawAttempt.ok) {
        payload.recovered = true;
        payload.result = deepCopyGeometry(rawAttempt.result);
        payload.resultSummary = rawAttempt.resultSummary;
        storeDebugGlobal("__cadDebugLastUnion", payload);
        storeDebugGlobal("__cadDebugLastBooleanFailure", payload);
        storeDebugGlobal("__cadDebugLastUnionFocus", payload.focus);
        storeDebugGlobal("__cadDebugLastBooleanFailureFocus", payload.focus);
        storeDebugGlobal("__cadDebugLastUnionPairSnapshot", payload.pairSnapshot);
        storeDebugGlobal("__cadDebugLastBooleanFailurePairSnapshot", payload.pairSnapshot);
        storeDebugGlobal("__cadDebugLastUnionRegression", payload.pairSnapshot?.regression || null);
        storeDebugGlobal("__cadDebugLastBooleanFailureRegression", payload.pairSnapshot?.regression || null);
        storeDebugGlobal("__cadDebugLastUnionNonMerge", null);
        storeDebugGlobal("__cadDebugLastBooleanNonMerge", null);
        pushDebugEntry("boolean.union.fallback", "pre-split failed; raw union recovered result", {
          context,
          preSplit: {
            didChange: payload.preSplit.didChange,
            splitPointCounts: payload.preSplit.splitPointCounts,
            overlapCount: payload.preSplit.overlapCount,
          },
          fallback: payload.fallback,
          focus: payload.focus
            ? {
                diagnosis: payload.focus.diagnosis,
                summary: payload.focus.summary,
                focusShapeIds: payload.focus.focusShapeIds,
                minimalFailingSubsetSourceShapeIds: payload.focus.minimalFailingSubsetSourceShapeIds,
              }
            : null,
          pairSnapshotSummary: payload.pairSnapshot
            ? {
                sourceShapeIds: payload.pairSnapshot.sourceShapeIds,
                rawUnionSucceeded: payload.pairSnapshot.rawUnionAttempt.ok,
                processedUnionSucceeded: payload.pairSnapshot.processedUnionAttempt.ok,
                pairOnlyProcessedUnionSucceeded: payload.pairSnapshot.pairOnlyProcessedUnionAttempt.ok,
              }
            : null,
          resultSummary: payload.resultSummary,
        }, "warn");
        if (payload.pairSnapshot?.regression?.isPreSplitRegression) {
          pushDebugEntry(
            "boolean.union.regression",
            `pre-split regression recovered via raw fallback: ${payload.pairSnapshot.sourceShapeIds.join(" + ")}`,
            payload.pairSnapshot.regression,
            "warn"
          );
        }
        return deepCopyGeometry(rawAttempt.result);
      }
    }
    storeDebugGlobal("__cadDebugLastUnion", payload);
    storeDebugGlobal("__cadDebugLastBooleanFailure", payload);
    storeDebugGlobal("__cadDebugLastUnionFocus", payload.focus);
    storeDebugGlobal("__cadDebugLastBooleanFailureFocus", payload.focus);
    storeDebugGlobal("__cadDebugLastUnionPairSnapshot", payload.pairSnapshot);
    storeDebugGlobal("__cadDebugLastBooleanFailurePairSnapshot", payload.pairSnapshot);
    storeDebugGlobal("__cadDebugLastUnionRegression", payload.pairSnapshot?.regression || null);
    storeDebugGlobal("__cadDebugLastBooleanFailureRegression", payload.pairSnapshot?.regression || null);
    storeDebugGlobal("__cadDebugLastUnionNonMerge", null);
    storeDebugGlobal("__cadDebugLastBooleanNonMerge", null);
    pushDebugEntry("boolean.union", "failure", {
      context,
      error: payload.error,
      inputSummaries: payload.inputSummaries,
      preSplit: {
        didChange: payload.preSplit.didChange,
        splitPointCounts: payload.preSplit.splitPointCounts,
        overlapCount: payload.preSplit.overlapCount,
      },
      failureIsolation: payload.failureIsolation,
      pairwiseAnalysis: payload.pairwiseAnalysis,
    }, "error");
    pushDebugEntry("boolean.union.focus", payload.focus.summary, payload.focus, "error");
    if (payload.pairSnapshot) {
      pushDebugEntry(
        "boolean.union.pair",
        `raw=${payload.pairSnapshot.rawUnionAttempt.ok ? "ok" : "error"} processed=${
          payload.pairSnapshot.processedUnionAttempt.ok ? "ok" : "error"
        } overlap=${payload.pairSnapshot.processedOverlap.overlapCount}`,
        payload.pairSnapshot,
        "error"
      );
      if (payload.pairSnapshot.regression?.isPreSplitRegression) {
        pushDebugEntry(
          "boolean.union.regression",
          `pre-split regression: ${payload.pairSnapshot.sourceShapeIds.join(" + ")}`,
          payload.pairSnapshot.regression,
          "error"
        );
      }
    }
    throw error;
  }
}

function differenceGeometry(subjectGeometry, clipGeometry, context = {}) {
  const cleanSubject = sanitizeGeometry(subjectGeometry);
  const cleanClip = sanitizeGeometry(clipGeometry);
  const payload = {
    operation: "difference",
    timestamp: new Date().toISOString(),
    context: cloneDebugValue(context),
    subject: deepCopyGeometry(cleanSubject),
    clip: deepCopyGeometry(cleanClip),
    subjectSummary: summarizeGeometry(cleanSubject),
    clipSummary: summarizeGeometry(cleanClip),
  };

  if (!cleanSubject.length) {
    payload.shortCircuit = "empty-subject";
    payload.result = [];
    payload.resultSummary = summarizeGeometry([]);
    storeDebugGlobal("__cadDebugLastDifference", payload);
    storeDebugGlobal("__cadDebugLastBooleanFailureFocus", null);
    storeDebugGlobal("__cadDebugLastBooleanFailurePairSnapshot", null);
    storeDebugGlobal("__cadDebugLastBooleanFailureRegression", null);
    pushDebugEntry("boolean.difference", "empty subject", payload);
    return [];
  }

  if (!cleanClip.length) {
    const result = deepCopyGeometry(cleanSubject);
    payload.shortCircuit = "empty-clip";
    payload.result = result;
    payload.resultSummary = summarizeGeometry(result);
    storeDebugGlobal("__cadDebugLastDifference", payload);
    storeDebugGlobal("__cadDebugLastBooleanFailureFocus", null);
    storeDebugGlobal("__cadDebugLastBooleanFailurePairSnapshot", null);
    storeDebugGlobal("__cadDebugLastBooleanFailureRegression", null);
    pushDebugEntry("boolean.difference", "empty clip passthrough", {
      context,
      subjectSummary: payload.subjectSummary,
    });
    return result;
  }

  const preprocessed = preprocessDifferenceInputs(cleanSubject, cleanClip);
  payload.preSplit = {
    didChange: preprocessed.didChange,
    splitPointCounts: preprocessed.splitPointCounts,
    overlapCount: preprocessed.overlapCount,
    overlapHints: preprocessed.overlapHints,
    subject: deepCopyGeometry(preprocessed.subject),
    clip: deepCopyGeometry(preprocessed.clip),
    subjectSummary: summarizeGeometry(preprocessed.subject),
    clipSummary: summarizeGeometry(preprocessed.clip),
  };

  pushDebugEntry("boolean.difference", "start", {
    context,
    subjectSummary: payload.subjectSummary,
    clipSummary: payload.clipSummary,
    preSplit: {
      didChange: payload.preSplit.didChange,
      splitPointCounts: payload.preSplit.splitPointCounts,
      overlapCount: payload.preSplit.overlapCount,
    },
  });

  try {
    const result = sanitizeGeometry(polygonBoolean.difference(preprocessed.subject, preprocessed.clip));
    payload.result = deepCopyGeometry(result);
    payload.resultSummary = summarizeGeometry(result);
    storeDebugGlobal("__cadDebugLastDifference", payload);
    storeDebugGlobal("__cadDebugLastBooleanFailureFocus", null);
    storeDebugGlobal("__cadDebugLastBooleanFailurePairSnapshot", null);
    storeDebugGlobal("__cadDebugLastBooleanFailureRegression", null);
    pushDebugEntry("boolean.difference", "success", {
      context,
      resultSummary: payload.resultSummary,
      preSplit: {
        didChange: payload.preSplit.didChange,
        splitPointCounts: payload.preSplit.splitPointCounts,
        overlapCount: payload.preSplit.overlapCount,
      },
    });
    return result;
  } catch (error) {
    payload.error = serializeError(error);
    if (preprocessed.didChange) {
      const rawAttempt = runDifferenceAttempt(cleanSubject, cleanClip);
      payload.fallback = {
        kind: "raw-after-pre-split-failure",
        rawSucceeded: rawAttempt.ok,
        processedError: payload.error,
        rawError: rawAttempt.ok ? null : rawAttempt.error,
        rawResultSummary: rawAttempt.ok ? rawAttempt.resultSummary : null,
      };
      if (rawAttempt.ok) {
        payload.recovered = true;
        payload.result = deepCopyGeometry(rawAttempt.result);
        payload.resultSummary = rawAttempt.resultSummary;
        storeDebugGlobal("__cadDebugLastDifference", payload);
        storeDebugGlobal("__cadDebugLastBooleanFailure", payload);
        storeDebugGlobal("__cadDebugLastBooleanFailureFocus", null);
        storeDebugGlobal("__cadDebugLastBooleanFailurePairSnapshot", null);
        storeDebugGlobal("__cadDebugLastBooleanFailureRegression", null);
        pushDebugEntry("boolean.difference.fallback", "pre-split failed; raw difference recovered result", {
          context,
          subjectSummary: payload.subjectSummary,
          clipSummary: payload.clipSummary,
          preSplit: {
            didChange: payload.preSplit.didChange,
            splitPointCounts: payload.preSplit.splitPointCounts,
            overlapCount: payload.preSplit.overlapCount,
          },
          fallback: payload.fallback,
          resultSummary: payload.resultSummary,
        }, "warn");
        return deepCopyGeometry(rawAttempt.result);
      }
    }
    storeDebugGlobal("__cadDebugLastDifference", payload);
    storeDebugGlobal("__cadDebugLastBooleanFailure", payload);
    storeDebugGlobal("__cadDebugLastBooleanFailureFocus", null);
    storeDebugGlobal("__cadDebugLastBooleanFailurePairSnapshot", null);
    storeDebugGlobal("__cadDebugLastBooleanFailureRegression", null);
    pushDebugEntry("boolean.difference", "failure", {
      context,
      error: payload.error,
      subjectSummary: payload.subjectSummary,
      clipSummary: payload.clipSummary,
      preSplit: {
        didChange: payload.preSplit.didChange,
        splitPointCounts: payload.preSplit.splitPointCounts,
        overlapCount: payload.preSplit.overlapCount,
        overlapHints: payload.preSplit.overlapHints,
      },
    }, "error");
    throw error;
  }
}

function worldToDraft(point) {
  return worldToDraftWithPlane(point, state.draftOrigin, getDraftAngle());
}

function draftToWorld(point) {
  return draftToWorldWithPlane(point, state.draftOrigin, getDraftAngle());
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
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
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
  const cleanA = sanitizeGeometry(a);
  const cleanB = sanitizeGeometry(b);
  if (!cleanA.length || !cleanB.length) return false;

  return sanitizeGeometry(polygonBoolean.intersection(cleanA, cleanB)).length > 0;
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

function buildUnionShapes(layerId, sourceShapes, context = {}) {
  if (!sourceShapes.length) return [];

  return createLayerShapeRecordsFromGeometry(
    layerId,
    unionGeometryList(
      sourceShapes.map((shape) => shape.geometry),
      {
        layerId,
        stage: "buildUnionShapes",
        sourceShapeIds: sourceShapes.map((shape) => shape.id),
        sourceShapeCount: sourceShapes.length,
        ...context,
      }
    )
  );
}

function replaceLayerShapes(layerId, nextLayerShapes) {
  const otherShapes = state.shapes.filter((shape) => shape.layerId !== layerId);
  state.shapes = [...otherShapes, ...nextLayerShapes];
}

function rebuildLayerShapes(layerId, context = {}) {
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layerId);

  pushDebugEntry("rebuildLayerShapes", "start", {
    layerId,
    context,
    sourceShapeCount: layerShapes.length,
    sourceShapes: layerShapes.map((shape) => summarizeShape(shape)),
  });

  const nextLayerShapes = buildUnionShapes(layerId, layerShapes, {
    stage: "rebuildLayerShapes",
    ...context,
  });

  replaceLayerShapes(layerId, nextLayerShapes);

  pushDebugEntry("rebuildLayerShapes", "complete", {
    layerId,
    context,
    sourceShapeCount: layerShapes.length,
    resultShapeCount: nextLayerShapes.length,
    resultShapes: nextLayerShapes.map((shape) => summarizeShape(shape)),
  });

  return nextLayerShapes;
}

function insertShapeToLayer(layerId, shape) {
  pushDebugEntry("insertShapeToLayer", "append incoming shape", {
    layerId,
    shape: summarizeShape(shape),
    layerShapeCountBeforeInsert: state.shapes.filter((candidate) => candidate.layerId === layerId).length,
  });

  state.shapes.push(shape);

  pushDebugEntry("insertShapeToLayer", "shape inserted before rebuild", {
    layerId,
    insertedShapeId: shape.id,
    layerShapeCountAfterInsert: state.shapes.filter((candidate) => candidate.layerId === layerId).length,
  });

  rebuildLayerShapes(layerId, {
    reason: "insertShapeToLayer",
    insertedShapeId: shape.id,
  });
}

function subtractGeometryFromLayer(layerId, subtractionGeometry) {
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layerId);
  if (!layerShapes.length) {
    pushDebugEntry("subtractGeometryFromLayer", "no-op; layer has no shapes", {
      layerId,
      subtractionGeometry: summarizeGeometry(subtractionGeometry),
    }, "warn");
    return;
  }

  const affectsSelection = getSelectedShapes().some((shape) => shape.layerId === layerId);
  pushDebugEntry("subtractGeometryFromLayer", "start", {
    layerId,
    affectsSelection,
    layerShapeCount: layerShapes.length,
    layerShapes: layerShapes.map((shape) => summarizeShape(shape)),
    subtractionGeometry: summarizeGeometry(subtractionGeometry),
  });

  const nextGeometry = differenceGeometry(
    unionGeometryList(layerShapes.map((shape) => shape.geometry), {
      layerId,
      stage: "subtractGeometryFromLayer",
      phase: "subject-union",
      sourceShapeIds: layerShapes.map((shape) => shape.id),
    }),
    subtractionGeometry,
    {
      layerId,
      stage: "subtractGeometryFromLayer",
      phase: "difference",
      sourceShapeIds: layerShapes.map((shape) => shape.id),
      subtractionSummary: summarizeGeometry(subtractionGeometry),
    }
  );

  const nextLayerShapes = createLayerShapeRecordsFromGeometry(layerId, nextGeometry);
  replaceLayerShapes(layerId, nextLayerShapes);

  if (affectsSelection) clearSelectionForLayer(layerId);

  pushDebugEntry("subtractGeometryFromLayer", "complete", {
    layerId,
    affectsSelection,
    resultGeometry: summarizeGeometry(nextGeometry),
    resultShapeCount: nextLayerShapes.length,
    resultShapes: nextLayerShapes.map((shape) => summarizeShape(shape)),
  });
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
  const draftAngle = getDraftAngle();
  targetCtx.translate(state.camera.x, state.camera.y);
  targetCtx.scale(state.camera.zoom, state.camera.zoom);
  targetCtx.rotate(-draftAngle);
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
  const deltaWorld = rotatePoint(deltaDraft, state.draftOriginDragAngle);

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
  setDraftAngleBase(Math.atan2(endSnap.world.y - startSnap.world.y, endSnap.world.x - startSnap.world.x));
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
  state.draftAngleStepOffset = normalizeRotationStepOffset(state.draftAngleStepOffset + Math.trunc(stepDelta));
  if (state.draggingDraftOrigin) {
    state.draftOriginDragStartScreen = { x: state.pointerScreen.x, y: state.pointerScreen.y };
    state.draftOriginDragStartOrigin = { x: state.draftOrigin.x, y: state.draftOrigin.y };
    state.draftOriginDragAngle = getDraftAngle();
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
      state.draftOriginDragAngle = getDraftAngle();
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
  const startedDragging = state.dragging;
  const startedTool = state.tool;
  const startedDrawOperation = state.drawOperation;
  const finishContext = {
    eventType: e ? e.type : "synthetic",
    tool: startedTool,
    drawOperation: startedDrawOperation,
    activeLayerId: state.activeLayerId,
    startedDragging,
    draftShape: state.draftShape
      ? {
          small: !!state.draftShape.small,
          bounds: serializeDebugBounds(state.draftShape.bounds),
          geometry: summarizeGeometry(state.draftShape.geometry),
        }
      : null,
  };
  let finishError = null;

  pushDebugEntry("finishDrag", "start", finishContext);

  try {
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

      pushDebugEntry("finishDrag", "complete draft align drag", {
        ...finishContext,
        canApply,
        didApply,
      });
      cancelDraftAlignDrag();
      if (didApply) refreshPointerDerivedState();
      updateCursor();
      render();
      return;
    }

    if (state.draggingDraftOrigin) {
      state.draggingDraftOrigin = false;
      state.current = draftToWorld(state.draftCurrent);
      pushDebugEntry("finishDrag", "complete draft origin drag", finishContext);
      updateCursor();
      render();
      return;
    }

    if (state.panning) {
      state.panning = false;
      pushDebugEntry("finishDrag", "complete pan drag", finishContext);
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
        pushDebugEntry("finishDrag", "select toggle commit", {
          ...finishContext,
          selectionShapeIds: [...state.selection.shapeIds],
        });
        render();
        return;
      }

      if (state.selection.mode === "box") {
        updateSelectionBoxSelection(state.draftCurrent);
        resetSelectionInteraction();
        state.dragging = false;
        pushDebugEntry("finishDrag", "select box commit", {
          ...finishContext,
          selectionShapeIds: [...state.selection.shapeIds],
        });
        render();
        return;
      }

      const movedGeometriesByLayer = state.selection.modified ? collectSelectedGeometriesByLayer() : null;
      const affectedLayerIds = movedGeometriesByLayer ? Object.keys(movedGeometriesByLayer) : [];

      pushDebugEntry("finishDrag", "select move commit", {
        ...finishContext,
        selectionModified: state.selection.modified,
        affectedLayerIds,
      });

      resetSelectionInteraction();
      state.dragging = false;

      if (affectedLayerIds.length) {
        for (const layerId of affectedLayerIds) {
          rebuildLayerShapes(layerId, {
            reason: "finishDrag-select-move",
          });
        }

        setSelectedShapeIds(getShapeIdsIntersectingLayerGeometries(movedGeometriesByLayer));
      }

      render();
      return;
    }

    if (state.tool === "draw") {
      if (state.draftShape && !state.draftShape.small) {
        pushDebugEntry("finishDrag", "draw commit begin", {
          ...finishContext,
          drawOperation: state.drawOperation,
          draftGeometry: summarizeGeometry(state.draftShape.geometry),
        });

        if (state.drawOperation === "subtract") {
          subtractGeometryFromLayer(state.activeLayerId, state.draftShape.geometry);
        } else {
          const shape = createShapeRecord(state.activeLayerId, state.draftShape.geometry);
          pushDebugEntry("finishDrag", "created layer insert candidate", {
            ...finishContext,
            createdShape: summarizeShape(shape),
          });
          if (shape) insertShapeToLayer(state.activeLayerId, shape);
        }

        pushDebugEntry("finishDrag", "draw commit complete", {
          ...finishContext,
          activeLayerId: state.activeLayerId,
        });
      } else {
        pushDebugEntry("finishDrag", "draw commit skipped; draft shape empty or small", finishContext, "warn");
      }
    }

    state.dragging = false;
    state.drawOperation = "add";
    resetDrawSession();
    render();
  } catch (error) {
    finishError = error;
    pushDebugEntry("finishDrag", "failure", {
      ...finishContext,
      currentLayerShapes: state.shapes
        .filter((shape) => shape.layerId === state.activeLayerId)
        .map((shape) => summarizeShape(shape)),
      error: serializeError(error),
      lastUnion: window.__cadDebugLastUnion,
      lastDifference: window.__cadDebugLastDifference,
      lastBooleanFailure: window.__cadDebugLastBooleanFailure,
    }, "error");
  } finally {
    if (finishError) {
      if (startedDragging && startedTool === "draw") {
        state.dragging = false;
        state.drawOperation = "add";
        resetDrawSession();
      } else if (startedDragging && startedTool === "select") {
        state.dragging = false;
        resetSelectionInteraction();
      }

      updateCursor();
      render();
    }
  }
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
    state.spacePressed = false;
    refreshPointerDerivedState();
    updateCursor();
    render();
  }
});

window.addEventListener("error", (event) => {
  pushDebugEntry("runtime.error", "uncaught window error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: serializeError(event.error),
    lastBooleanFailure: window.__cadDebugLastBooleanFailure,
  }, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  pushDebugEntry("runtime.error", "unhandled promise rejection", {
    reason:
      event.reason instanceof Error
        ? serializeError(event.reason)
        : {
            value: cloneDebugValue(event.reason),
          },
    lastBooleanFailure: window.__cadDebugLastBooleanFailure,
  }, "error");
});

window.addEventListener("resize", resizeCanvas);

updateZoomLabel();
updateWorkplaneStatus();
updateDebugStatus("idle");
updateCursor();
renderLayersPanel();
syncDrawSizeInput();
resizeCanvas();
