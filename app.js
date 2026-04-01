import { ClipType, FillRule, PolyTree64, booleanOpWithPolyTree, isPositive, simplifyPaths } from "clipper2-ts";
import {
  createDraftAngleStore,
  DEFAULT_DRAFT_ANGLE_FAMILY_ID,
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
const gridStatus = document.getElementById("grid-status");
const workplaneStatus = document.getElementById("workplane-status");
const settingsButton = document.getElementById("settingsButton");
const settingsMenu = document.getElementById("settingsMenu");
const settingsCloseButton = document.getElementById("settingsCloseButton");
const settingsApplyButton = document.getElementById("settingsApplyButton");
const settingsCellSizeInput = document.getElementById("settingsCellSizeInput");
const modalBackdrop = document.getElementById("modalBackdrop");
const draftRulerTop = document.getElementById("draft-ruler-top");
const draftRulerLeft = document.getElementById("draft-ruler-left");
const draftRulerBottom = document.getElementById("draft-ruler-bottom");
const draftRulerRight = document.getElementById("draft-ruler-right");
const layersPanel = document.getElementById("layersPanel");
const layerSection = document.getElementById("layerSection");
const layerSectionToggle = document.getElementById("layerSectionToggle");
const layersList = document.getElementById("layers-list");
const layerAddBtn = document.getElementById("addLayerButton");
const addDrawingBtn = document.getElementById("addDrawingButton");
const layerFillInput = document.getElementById("layer-fill");
const settingsDisplayUnitButtons = Array.from(document.querySelectorAll("[data-settings-display-unit]"));
const settingsCellUnitButtons = Array.from(document.querySelectorAll("[data-settings-cell-unit]"));
const settingsSnapModeButtons = Array.from(document.querySelectorAll("[data-settings-snap-mode]"));

const DEFAULT_SETTINGS = Object.freeze({
  displayUnit: "m",
  cellUnit: "cm",
  cellSize: 5,
  snapMode: "adaptive",
});

const state = {
  tool: "draw",
  shapeType: "rect",
  shapes: [],
  drawingsUi: [{ id: "drawing-1", name: "Drawing 1", expanded: true, visible: true, layersSectionCollapsed: false }],
  layerSectionCollapsed: false,
  layers: [{ id: "layer-1", drawingId: "drawing-1", name: "Layer 1", visible: true, locked: false, fillColor: "#93c5fd", opacity: 1 }],
  activeDrawingId: "drawing-1",
  activeLayerId: "layer-1",
  nextDrawingId: 2,
  editingDrawingId: null,
  editingDrawingNameDraft: "",
  editingDrawingInitialName: "",
  editingLayerId: null,
  editingLayerNameDraft: "",
  editingLayerInitialName: "",
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
  leftPanelPointerDrag: null,
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
  settings: { ...DEFAULT_SETTINGS },
  settingsDraft: null,
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
const vertexMarkerRadiusPx = 2.5;
const minZoom = 0.02;
const maxZoom = 50;
const ellipseSegments = 96;
const squareBrushAxisDecisionDistancePx = 18;
const squareBrushAxisDecisionBiasPx = 8;
const gridMinorStrokeColor = "rgba(8, 12, 16, 0.12)";
const gridMidStrokeColor = "rgba(8, 12, 16, 0.2)";
const gridMajorStrokeColor = "rgba(8, 12, 16, 0.3)";
const gridAdaptiveStepFactors = Object.freeze([2, 2.5, 2]);
const visibleGridMidInterval = 5;
const visibleGridMajorInterval = 10;
const minVisibleGridStepPx = 18;
const rulerMinorLabelMinPx = 84;
const rulerMidLabelMinPx = 120;
const rulerLabelPaddingPx = 12;
const adaptiveMinimumCellSizeMm = 1;
const gridFadeMinPx = 4;
const gridFadeMaxPx = 14;
const maxGridLinesPerAxis = 2000;
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
const clipperSimplifyCollinearEpsilon = 1;
const MEASUREMENT_UNITS = Object.freeze({
  mm: { id: "mm", label: "Millimeters", shortLabel: "mm", toMm: 1, fractionDigits: 1 },
  cm: { id: "cm", label: "Centimeters", shortLabel: "cm", toMm: 10, fractionDigits: 2 },
  m: { id: "m", label: "Meters", shortLabel: "m", toMm: 1000, fractionDigits: 3 },
});
const GRID_SNAP_MODES = Object.freeze({
  adaptive: { id: "adaptive", label: "Adaptive" },
  locked: { id: "locked", label: "Locked" },
});
const draftRulerTopCtx = draftRulerTop.getContext("2d");
const draftRulerLeftCtx = draftRulerLeft.getContext("2d");
const draftRulerBottomCtx = draftRulerBottom.getContext("2d");
const draftRulerRightCtx = draftRulerRight.getContext("2d");
const draftRulerSurfaces = [
  { surface: draftRulerTop, context: draftRulerTopCtx },
  { surface: draftRulerLeft, context: draftRulerLeftCtx },
  { surface: draftRulerBottom, context: draftRulerBottomCtx },
  { surface: draftRulerRight, context: draftRulerRightCtx },
];
const draftAngleStore = createDraftAngleStore({
  precisionDecimals: geometryPrecisionDecimals,
});

function getCssTokenValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getMeasurementUnit(unitId) {
  return MEASUREMENT_UNITS[unitId] || MEASUREMENT_UNITS.mm;
}

function sanitizeMeasurementUnit(unitId, fallback = DEFAULT_SETTINGS.displayUnit) {
  return MEASUREMENT_UNITS[unitId] ? unitId : fallback;
}

function sanitizeGridSnapMode(modeId, fallback = DEFAULT_SETTINGS.snapMode) {
  return GRID_SNAP_MODES[modeId] ? modeId : fallback;
}

function sanitizeCellSize(value, fallback = DEFAULT_SETTINGS.cellSize) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return fallback;
  return Math.max(1, Math.min(100000, rounded));
}

function cloneSettings(settings = state.settings) {
  return {
    displayUnit: sanitizeMeasurementUnit(settings?.displayUnit, DEFAULT_SETTINGS.displayUnit),
    cellUnit: sanitizeMeasurementUnit(settings?.cellUnit, DEFAULT_SETTINGS.cellUnit),
    cellSize: sanitizeCellSize(settings?.cellSize, DEFAULT_SETTINGS.cellSize),
    snapMode: sanitizeGridSnapMode(settings?.snapMode, DEFAULT_SETTINGS.snapMode),
  };
}

function convertLengthToMm(value, unitId) {
  return Number(value) * getMeasurementUnit(unitId).toMm;
}

function getConfiguredCellSize(settings = state.settings) {
  return convertLengthToMm(settings.cellSize, settings.cellUnit);
}

function getGridCellSize() {
  return state.settings.snapMode === "adaptive" ? adaptiveMinimumCellSizeMm : getConfiguredCellSize();
}

function getCompactLengthUnitId(valueMm, fallbackUnitId = state.settings.cellUnit) {
  const absValueMm = Math.abs(Number(valueMm));
  if (!Number.isFinite(absValueMm)) return fallbackUnitId;
  if (absValueMm >= MEASUREMENT_UNITS.m.toMm) return "m";
  if (absValueMm >= MEASUREMENT_UNITS.cm.toMm) return "cm";
  if (absValueMm >= MEASUREMENT_UNITS.mm.toMm) return "mm";
  return fallbackUnitId;
}

function formatCompactLengthWithUnit(valueMm, fallbackUnitId = state.settings.cellUnit) {
  return formatLengthWithUnit(valueMm, getCompactLengthUnitId(valueMm, fallbackUnitId));
}

function getAdaptiveGridStepMultiplier(baseStepPx, minimumVisiblePx = minVisibleGridStepPx) {
  if (!Number.isFinite(baseStepPx) || baseStepPx <= 0) return 1;

  let multiplier = 1;
  let factorIndex = 0;
  while (baseStepPx * multiplier < minimumVisiblePx && multiplier < 1e12) {
    multiplier *= gridAdaptiveStepFactors[factorIndex % gridAdaptiveStepFactors.length];
    factorIndex += 1;
  }
  return multiplier;
}

function getAdaptiveGridMetrics() {
  const baseStep = getGridCellSize();
  const baseStepPx = baseStep * state.camera.zoom;
  const visibleMultiplier = getAdaptiveGridStepMultiplier(baseStepPx);
  const visibleStep = baseStep * visibleMultiplier;
  const visibleStepPx = baseStepPx * visibleMultiplier;
  const midEvery = visibleGridMidInterval;
  const majorEvery = visibleGridMajorInterval;
  let labelEvery = majorEvery;

  if (visibleStepPx >= rulerMinorLabelMinPx) {
    labelEvery = 1;
  } else if (visibleStepPx * midEvery >= rulerMidLabelMinPx) {
    labelEvery = midEvery;
  }

  return {
    baseStep,
    baseStepPx,
    visibleMultiplier,
    visibleStep,
    visibleStepPx,
    midEvery,
    majorEvery,
    labelEvery,
    midStep: visibleStep * midEvery,
    majorStep: visibleStep * majorEvery,
  };
}

function getVisibleGridMetrics() {
  if (state.settings.snapMode === "locked") {
    const visibleStep = getGridCellSize();
    const visibleStepPx = visibleStep * state.camera.zoom;
    return {
      baseStep: visibleStep,
      baseStepPx: visibleStepPx,
      visibleMultiplier: 1,
      visibleStep,
      visibleStepPx,
      midEvery: visibleGridMidInterval,
      majorEvery: visibleGridMajorInterval,
      labelEvery: visibleGridMajorInterval,
      midStep: visibleStep * visibleGridMidInterval,
      majorStep: visibleStep * visibleGridMajorInterval,
    };
  }

  return getAdaptiveGridMetrics();
}

function getEffectiveGridSnapStep() {
  return state.settings.snapMode === "adaptive" ? getAdaptiveGridMetrics().visibleStep : getGridCellSize();
}

function getGridTierOpacity(stepPx) {
  if (!Number.isFinite(stepPx) || stepPx <= gridFadeMinPx) return 0;
  if (stepPx >= gridFadeMaxPx) return 1;
  return Math.max(0, Math.min(1, (stepPx - gridFadeMinPx) / (gridFadeMaxPx - gridFadeMinPx)));
}

function formatLengthValue(valueMm, unitId = state.settings.displayUnit, maxFractionDigits = null) {
  const unit = getMeasurementUnit(unitId);
  const displayValue = Number(valueMm) / unit.toMm;
  const resolvedFractionDigits = maxFractionDigits ?? unit.fractionDigits;
  const rounded = Math.abs(displayValue) <= 10 ** -(resolvedFractionDigits + 1) ? 0 : displayValue;
  return rounded.toFixed(resolvedFractionDigits).replace(/\.?0+$/, "");
}

function formatLengthWithUnit(valueMm, unitId = state.settings.displayUnit, maxFractionDigits = null) {
  return `${formatLengthValue(valueMm, unitId, maxFractionDigits)} ${getMeasurementUnit(unitId).shortLabel}`;
}

function isSettingsMenuOpen() {
  return !!settingsMenu && !settingsMenu.classList.contains("hidden");
}

function getActiveDraftAngleStepCount() {
  return draftAngleStore.getActiveStepCount();
}

function getActiveDraftAngleRotation() {
  return draftAngleStore.getActiveRotation();
}

function setActiveDraftAngleFamily(familyId, stepIndex = 0) {
  return draftAngleStore.setActiveFamily(familyId, stepIndex);
}

function setActiveDraftAngleFree(baseAngleDeg, stepIndex = 0) {
  return draftAngleStore.setFreeAngle(baseAngleDeg, stepIndex);
}

function setDraftAngleFromDegrees(angleDeg) {
  return draftAngleStore.resolveAngle(angleDeg);
}

function setDraftAngleFromAlignedDegrees(angleDeg) {
  return draftAngleStore.resolveAlignedAngle(angleDeg);
}

function setDraftAngleFromAlignedDirection(dx, dy) {
  return draftAngleStore.resolveAlignedDirection(dx, dy);
}

function setDraftAngleFromRadians(angleRad) {
  setDraftAngleFromDegrees((angleRad * 180) / Math.PI);
}

function setDraftAngleFromAlignedRadians(angleRad) {
  setDraftAngleFromAlignedDegrees((angleRad * 180) / Math.PI);
}

function materializeActiveDraftAngleCandidateOnCommit() {
  const familyRecord = draftAngleStore.materializeActiveCandidate();
  renderLiveRegistry();
  return familyRecord;
}

function renderLiveRegistry() {
  console.table(draftAngleStore.getRegistryRows());
}

function logActiveDraftAngleTable(reason = "Draft Angle Active Table") {
  const snapshot = draftAngleStore.getSnapshot();
  const activeRotation = snapshot?.activeRotation || getActiveDraftAngleRotation();
  const activeState = snapshot?.activeState || null;

  console.table([
    {
      reason,
      mode: activeState?.mode || activeRotation?.mode || null,
      activeTableId: activeRotation?.familyId || activeState?.familyId || null,
      stepIndex: activeRotation?.stepIndex ?? activeState?.stepIndex ?? null,
      angleDeg: activeRotation?.angleDeg ?? null,
      signature: activeRotation?.signature || null,
    },
  ]);
}

function updateZoomLabel() {
  zoomLevel.textContent = Math.round(state.camera.zoom * 100) + "%";
}

function updateGridStatus() {
  if (!gridStatus) return;

  const snapModeLabel = GRID_SNAP_MODES[state.settings.snapMode]?.label || GRID_SNAP_MODES.adaptive.label;
  const cellSizeMm = state.settings.snapMode === "adaptive" ? getEffectiveGridSnapStep() : getGridCellSize();
  const cellLabel = formatLengthWithUnit(cellSizeMm, state.settings.displayUnit);

  gridStatus.textContent = `Grid ${snapModeLabel} | Cell ${cellLabel}`;
  gridStatus.title = `Grid ${snapModeLabel}. Cell ${cellLabel}.`;
}

function formatWorkplaneValue(value) {
  return formatLengthWithUnit(value, state.settings.displayUnit);
}

function formatWorkplaneAngleValue(value) {
  if (Math.abs(value) <= 0.005) return "0";
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function updateWorkplaneStatus() {
  const draftRotation = getActiveDraftAngleRotation();
  const atWorldOrigin = Math.abs(state.draftOrigin.x) <= 1e-9 && Math.abs(state.draftOrigin.y) <= 1e-9;
  const atWorldAngle = Math.abs(draftRotation.signedAngleDeg) <= 1e-9;
  const planeLabel = atWorldOrigin && atWorldAngle ? "default" : "custom";
  const angleDeg = draftRotation.signedAngleDeg;
  workplaneStatus.textContent = `Plane: ${planeLabel} | Rot: ${formatWorkplaneAngleValue(angleDeg)}deg | Origin: ${formatWorkplaneValue(state.draftOrigin.x)}, ${formatWorkplaneValue(state.draftOrigin.y)}`;
}

function syncSettingsMenu() {
  if (!state.settingsDraft || !settingsMenu) return;

  for (const button of settingsDisplayUnitButtons) {
    const active = button.dataset.settingsDisplayUnit === state.settingsDraft.displayUnit;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  const adaptiveModeActive = state.settingsDraft.snapMode === "adaptive";

  for (const button of settingsCellUnitButtons) {
    const active = adaptiveModeActive ? button.dataset.settingsCellUnit === "mm" : button.dataset.settingsCellUnit === state.settingsDraft.cellUnit;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = adaptiveModeActive;
  }

  for (const button of settingsSnapModeButtons) {
    const active = button.dataset.settingsSnapMode === state.settingsDraft.snapMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  if (settingsCellSizeInput) {
    settingsCellSizeInput.value = adaptiveModeActive ? "1" : String(state.settingsDraft.cellSize);
    settingsCellSizeInput.disabled = adaptiveModeActive;
  }
}

function openSettingsMenu() {
  if (!settingsMenu || !modalBackdrop) return;

  state.settingsDraft = cloneSettings(state.settings);
  syncSettingsMenu();
  settingsMenu.classList.remove("hidden");
  modalBackdrop.classList.remove("hidden");
}

function closeSettingsMenu() {
  if (!settingsMenu || !modalBackdrop) return;

  settingsMenu.classList.add("hidden");
  modalBackdrop.classList.add("hidden");
  state.settingsDraft = null;
}

function applySettingsDraft() {
  if (!state.settingsDraft) return;

  if (settingsCellSizeInput && state.settingsDraft.snapMode !== "adaptive") {
    state.settingsDraft.cellSize = sanitizeCellSize(settingsCellSizeInput.value, state.settingsDraft.cellSize);
  }

  state.settings = cloneSettings(state.settingsDraft);
  state.settingsDraft = cloneSettings(state.settings);
  syncSettingsMenu();
  refreshPointerDerivedState();
  updateGridStatus();
  updateWorkplaneStatus();
  render();
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

function createDrawingUiRecord(name = "Drawing " + state.nextDrawingId) {
  const id = "drawing-" + state.nextDrawingId;
  state.nextDrawingId += 1;
  return {
    id,
    name,
    expanded: false,
    visible: true,
    layersSectionCollapsed: false,
  };
}

function createLayerRecord(drawingId, options = {}) {
  const id = "layer-" + state.nextLayerId;
  const name = options.name || "Layer " + state.nextLayerId;
  const fillColor = options.fillColor || getNextLayerColor();
  state.nextLayerId += 1;
  return {
    id,
    drawingId,
    name,
    visible: options.visible ?? true,
    locked: options.locked ?? false,
    fillColor,
    opacity: Number.isFinite(options.opacity) ? options.opacity : 1,
  };
}

function createDrawingWithDefaultLayer(name = "Drawing " + state.nextDrawingId) {
  const drawing = createDrawingUiRecord(name);
  const layer = createLayerRecord(drawing.id);
  return { drawing, layer };
}

function getPrimaryDrawingUi() {
  if (!state.drawingsUi.length) {
    const fallback = createDrawingWithDefaultLayer("Drawing 1");
    fallback.drawing.expanded = true;
    state.drawingsUi.push(fallback.drawing);
    state.layers.push(fallback.layer);
    state.activeDrawingId = fallback.drawing.id;
    state.activeLayerId = fallback.layer.id;
  }

  const activeDrawing = getDrawingUiById(state.activeDrawingId);
  if (activeDrawing) return activeDrawing;

  const fallbackDrawing = state.drawingsUi[0] || null;
  if (fallbackDrawing) setActiveDrawingById(fallbackDrawing.id);
  return fallbackDrawing;
}

function getDrawingUiById(id) {
  return state.drawingsUi.find((drawing) => drawing.id === id) || null;
}

function getActiveDrawingUi() {
  const activeDrawing = getDrawingUiById(state.activeDrawingId);
  if (activeDrawing) return activeDrawing;

  const activeLayer = getActiveLayer();
  const activeLayerDrawing = activeLayer ? getDrawingUiById(getLayerDrawingId(activeLayer)) : null;
  return activeLayerDrawing || getPrimaryDrawingUi();
}

function getLayerDrawingId(layer) {
  return layer?.drawingId || getPrimaryDrawingUi().id;
}

function getLayersForDrawingInStorageOrder(drawingId) {
  return state.layers.filter((layer) => getLayerDrawingId(layer) === drawingId);
}

function getLayersForDrawing(drawingId) {
  return getLayersForDrawingInStorageOrder(drawingId).slice().reverse();
}

function getDrawingLayerFallback(drawingId) {
  return getLayersForDrawing(drawingId)[0] || null;
}

function setActiveDrawingById(drawingId, options = {}) {
  const drawing = getDrawingUiById(drawingId);
  if (!drawing) return false;

  if (state.editingDrawingId && state.editingDrawingId !== drawing.id) {
    state.editingDrawingId = null;
    state.editingDrawingNameDraft = "";
    state.editingDrawingInitialName = "";
  }

  if (state.editingLayerId) {
    const editingLayer = getLayerById(state.editingLayerId);
    if (!editingLayer || getLayerDrawingId(editingLayer) !== drawing.id) {
      state.editingLayerId = null;
      state.editingLayerNameDraft = "";
      state.editingLayerInitialName = "";
    }
  }

  state.activeDrawingId = drawing.id;
  state.drawingsUi.forEach((entry) => {
    entry.expanded = entry.id === drawing.id;
  });

  const nextLayerId = options.layerId || (() => {
    const activeLayer = getActiveLayer();
    if (activeLayer && getLayerDrawingId(activeLayer) === drawing.id) return activeLayer.id;
    return getDrawingLayerFallback(drawing.id)?.id || null;
  })();

  state.activeLayerId = nextLayerId;
  return true;
}

function isDrawingVisible(drawingId) {
  const drawing = getDrawingUiById(drawingId);
  return drawing ? drawing.visible !== false : true;
}

function isLayerActuallyVisible(layer) {
  return !!layer && layer.visible !== false && isDrawingVisible(getLayerDrawingId(layer));
}

function isLayerAvailableForEditing(layer) {
  return isLayerActuallyVisible(layer) && !layer.locked;
}

function getRenderableLayersInPaintOrder() {
  const orderedLayers = [];
  for (const drawing of state.drawingsUi.slice().reverse()) {
    if (drawing.visible === false) continue;
    orderedLayers.push(...getLayersForDrawingInStorageOrder(drawing.id));
  }
  return orderedLayers;
}

function getLayerShapeCount(layerId) {
  return state.shapes.filter((shape) => shape.layerId === layerId).length;
}

function cloneGeometry(geometry) {
  return geometry.map((polygon) => polygon.map((ring) => ring.map((point) => [point[0], point[1]])));
}

function cloneBounds(bounds) {
  return bounds
    ? {
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
      }
    : null;
}

function createInlineIcon(kind, options = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");

  if (kind === "duplicate") {
    const horizontal = document.createElementNS(ns, "line");
    horizontal.setAttribute("x1", "3");
    horizontal.setAttribute("y1", "8");
    horizontal.setAttribute("x2", "13");
    horizontal.setAttribute("y2", "8");
    horizontal.setAttribute("stroke", "currentColor");
    horizontal.setAttribute("stroke-width", "1.6");
    horizontal.setAttribute("stroke-linecap", "round");
    svg.appendChild(horizontal);

    const vertical = document.createElementNS(ns, "line");
    vertical.setAttribute("x1", "8");
    vertical.setAttribute("y1", "3");
    vertical.setAttribute("x2", "8");
    vertical.setAttribute("y2", "13");
    vertical.setAttribute("stroke", "currentColor");
    vertical.setAttribute("stroke-width", "1.6");
    vertical.setAttribute("stroke-linecap", "round");
    svg.appendChild(vertical);
    return svg;
  }

  if (kind === "visibility") {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "8");
    circle.setAttribute("cy", "8");
    circle.setAttribute("r", "4");
    if (options.filled) {
      circle.setAttribute("fill", "currentColor");
    } else {
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", "currentColor");
      circle.setAttribute("stroke-width", "1.6");
    }
    svg.appendChild(circle);
    return svg;
  }

  if (kind === "delete") {
    const lineA = document.createElementNS(ns, "line");
    lineA.setAttribute("x1", "4");
    lineA.setAttribute("y1", "4");
    lineA.setAttribute("x2", "12");
    lineA.setAttribute("y2", "12");
    lineA.setAttribute("stroke", "currentColor");
    lineA.setAttribute("stroke-width", "1.6");
    lineA.setAttribute("stroke-linecap", "round");
    svg.appendChild(lineA);

    const lineB = document.createElementNS(ns, "line");
    lineB.setAttribute("x1", "12");
    lineB.setAttribute("y1", "4");
    lineB.setAttribute("x2", "4");
    lineB.setAttribute("y2", "12");
    lineB.setAttribute("stroke", "currentColor");
    lineB.setAttribute("stroke-width", "1.6");
    lineB.setAttribute("stroke-linecap", "round");
    svg.appendChild(lineB);
    return svg;
  }

  return svg;
}

function moveArrayItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items.slice();
  }

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function getLayerListElementForDrawing(drawingId) {
  return layersList.querySelector(`.drawing-subsection-list[data-drawing-id="${drawingId}"]`);
}

function getDrawingCardElements() {
  return Array.from(layersList.querySelectorAll(".drawing-card"));
}

function clearLeftPanelDropIndicatorClasses(listEl = null) {
  const root = listEl || layersList;
  root.querySelectorAll(".drag-insert-before, .drag-insert-after").forEach((element) => {
    element.classList.remove("drag-insert-before");
    element.classList.remove("drag-insert-after");
  });
}

function reorderDrawingsFromVisualOrder(visualDrawingIds) {
  const reordered = visualDrawingIds.map((drawingId) => getDrawingUiById(drawingId)).filter(Boolean);
  if (reordered.length !== state.drawingsUi.length) return;
  state.drawingsUi = reordered;
}

function reorderLayersForDrawingFromVisualOrder(drawingId, visualLayerIds) {
  const drawingLayers = getLayersForDrawingInStorageOrder(drawingId);
  if (!drawingLayers.length) return;

  const reorderedTopToBottom = visualLayerIds
    .map((layerId) => drawingLayers.find((layer) => layer.id === layerId))
    .filter(Boolean);

  if (reorderedTopToBottom.length !== drawingLayers.length) return;

  const reorderedBottomToTop = reorderedTopToBottom.slice().reverse();
  let reorderedIndex = 0;
  state.layers = state.layers.map((layer) =>
    getLayerDrawingId(layer) === drawingId ? reorderedBottomToTop[reorderedIndex++] : layer
  );
}

function drawingDropPositionFromClientY(clientY, sourceDrawingId) {
  const items = state.drawingsUi;
  if (!items.length) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const fromIndex = items.findIndex((drawing) => drawing.id === sourceDrawingId);
  if (fromIndex === -1) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const cards = getDrawingCardElements();
  if (!cards.length) return { rawIndex: fromIndex, toIndex: fromIndex, fromIndex };

  let rawIndex = cards.length;
  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect();
    if (clientY < rect.top + rect.height * 0.5) {
      rawIndex = index;
      break;
    }
  }

  let toIndex = rawIndex;
  if (toIndex > fromIndex) toIndex -= 1;

  return {
    rawIndex,
    toIndex: Math.max(0, Math.min(items.length - 1, toIndex)),
    fromIndex,
  };
}

function layerDropPositionFromClientY(drawingId, clientY, sourceLayerId) {
  const items = getLayersForDrawing(drawingId);
  const list = getLayerListElementForDrawing(drawingId);
  if (!items.length || !list) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const fromIndex = items.findIndex((layer) => layer.id === sourceLayerId);
  if (fromIndex === -1) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const cards = Array.from(list.querySelectorAll(".layer-card"));
  if (!cards.length) return { rawIndex: fromIndex, toIndex: fromIndex, fromIndex };

  let rawIndex = cards.length;
  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect();
    if (clientY < rect.top + rect.height * 0.5) {
      rawIndex = index;
      break;
    }
  }

  let toIndex = rawIndex;
  if (toIndex > fromIndex) toIndex -= 1;

  return {
    rawIndex,
    toIndex: Math.max(0, Math.min(items.length - 1, toIndex)),
    fromIndex,
  };
}

function updateDrawingDropIndicator(rawIndex, toIndex, fromIndex) {
  clearLeftPanelDropIndicatorClasses(layersList);

  if (!state.leftPanelPointerDrag || toIndex === -1 || fromIndex === -1 || toIndex === fromIndex) return;

  const cards = getDrawingCardElements();
  if (!cards.length) return;

  if (rawIndex >= cards.length) {
    cards[cards.length - 1].classList.add("drag-insert-after");
    return;
  }

  cards[Math.max(0, rawIndex)].classList.add("drag-insert-before");
}

function updateLayerDropIndicator(drawingId, rawIndex, toIndex, fromIndex) {
  const list = getLayerListElementForDrawing(drawingId);
  clearLeftPanelDropIndicatorClasses(list);

  if (!state.leftPanelPointerDrag || !list || toIndex === -1 || fromIndex === -1 || toIndex === fromIndex) return;

  const cards = Array.from(list.querySelectorAll(".layer-card"));
  if (!cards.length) return;

  if (rawIndex >= cards.length) {
    cards[cards.length - 1].classList.add("drag-insert-after");
    return;
  }

  cards[Math.max(0, rawIndex)].classList.add("drag-insert-before");
}

function clearLeftPanelPointerDrag(commit = true) {
  const drag = state.leftPanelPointerDrag;
  if (!drag) return;

  if (drag.sourceCard) drag.sourceCard.classList.remove("dragging");
  if (drag.type === "drawing") {
    clearLeftPanelDropIndicatorClasses(layersList);
  } else {
    clearLeftPanelDropIndicatorClasses(getLayerListElementForDrawing(drag.drawingId));
  }
  if (layersPanel) layersPanel.classList.remove("drag-reordering");

  state.leftPanelPointerDrag = null;

  if (commit && drag.fromIndex !== -1 && drag.dropIndex !== -1 && drag.dropIndex !== drag.fromIndex) {
    if (drag.type === "drawing") {
      const currentVisualDrawings = state.drawingsUi.map((drawing) => drawing.id);
      const nextVisualDrawings = moveArrayItem(currentVisualDrawings, drag.fromIndex, drag.dropIndex);
      reorderDrawingsFromVisualOrder(nextVisualDrawings);
    } else {
      const currentVisualLayers = getLayersForDrawing(drag.drawingId).map((layer) => layer.id);
      const nextVisualLayers = moveArrayItem(currentVisualLayers, drag.fromIndex, drag.dropIndex);
      reorderLayersForDrawingFromVisualOrder(drag.drawingId, nextVisualLayers);
    }
    renderLayersPanel();
    render();
    return;
  }

  renderLayersPanel();
}

function beginDrawingPointerDrag(event, card, drawingId) {
  if (!card || !drawingId) return;
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();
  clearLeftPanelPointerDrag(false);

  card.classList.add("dragging");
  if (layersPanel) layersPanel.classList.add("drag-reordering");

  const drop = drawingDropPositionFromClientY(event.clientY, drawingId);
  state.leftPanelPointerDrag = {
    type: "drawing",
    pointerId: event.pointerId,
    drawingId,
    sourceCard: card,
    dropIndex: drop.toIndex,
    rawIndex: drop.rawIndex,
    fromIndex: drop.fromIndex,
  };

  updateDrawingDropIndicator(drop.rawIndex, drop.toIndex, drop.fromIndex);
}

function beginLayerPointerDrag(event, card, drawingId, layerId) {
  if (!card || !drawingId || !layerId) return;
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();
  clearLeftPanelPointerDrag(false);

  card.classList.add("dragging");
  if (layersPanel) layersPanel.classList.add("drag-reordering");

  const drop = layerDropPositionFromClientY(drawingId, event.clientY, layerId);
  state.leftPanelPointerDrag = {
    type: "layer",
    pointerId: event.pointerId,
    drawingId,
    layerId,
    sourceCard: card,
    dropIndex: drop.toIndex,
    rawIndex: drop.rawIndex,
    fromIndex: drop.fromIndex,
  };

  updateLayerDropIndicator(drawingId, drop.rawIndex, drop.toIndex, drop.fromIndex);
}

function syncActiveLayerControls() {
  const activeLayer = getActiveLayer();
  if (!activeLayer || !layerFillInput) return;
  layerFillInput.value = activeLayer.fillColor;
}

function beginRenameDrawing(drawingId) {
  const drawing = getDrawingUiById(drawingId);
  if (!drawing) return;
  state.editingDrawingId = drawingId;
  state.editingDrawingInitialName = drawing.name;
  state.editingDrawingNameDraft = drawing.name;
  renderLayersPanel();
}

function endRenameDrawing(commit = true) {
  const drawing = getDrawingUiById(state.editingDrawingId);
  if (commit && drawing) {
    const nextName = String(state.editingDrawingNameDraft || "").trim();
    drawing.name = nextName || state.editingDrawingInitialName || drawing.name;
  }

  state.editingDrawingId = null;
  state.editingDrawingNameDraft = "";
  state.editingDrawingInitialName = "";
  renderLayersPanel();
}

function beginRenameLayer(layerId) {
  const layer = getLayerById(layerId);
  if (!layer) return;
  state.editingLayerId = layerId;
  state.editingLayerInitialName = layer.name;
  state.editingLayerNameDraft = layer.name;
  renderLayersPanel();
}

function endRenameLayer(commit = true) {
  const layer = getLayerById(state.editingLayerId);
  if (commit && layer) {
    const nextName = String(state.editingLayerNameDraft || "").trim();
    layer.name = nextName || state.editingLayerInitialName || layer.name;
  }

  state.editingLayerId = null;
  state.editingLayerNameDraft = "";
  state.editingLayerInitialName = "";
  renderLayersPanel();
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

function snapValueToGrid(value, step = getEffectiveGridSnapStep()) {
  return Math.round(value / step) * step;
}

function snapValueToGridWithOffset(value, offset = 0, step = getEffectiveGridSnapStep()) {
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
  return getStripCellWidth(cellWidth) * getEffectiveGridSnapStep();
}

function getStripSnapOffset(cellWidth = state.stripCellWidth) {
  return getStripCellWidth(cellWidth) % 2 === 0 ? 0 : getEffectiveGridSnapStep() / 2;
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
  return getSquareBrushCellWidth(cellWidth) * getEffectiveGridSnapStep();
}

function getSquareBrushSnapOffset(cellWidth = state.drawSize) {
  return getSquareBrushCellWidth(cellWidth) % 2 === 0 ? 0 : getEffectiveGridSnapStep() / 2;
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

function drawGeometryVertices(targetCtx, geometry, radius = vertexMarkerRadiusPx / state.camera.zoom) {
  forEachRing(geometry, (ring) => {
    for (const point of ring) {
      targetCtx.moveTo(point[0] + radius, point[1]);
      targetCtx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    }
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

function getDraftTransformSnapTarget(
  worldPoint,
  maxDistance = draftTransformSnapRadiusPx / state.camera.zoom,
  options = {}
) {
  if (!worldPoint) return null;

  const { allowEdge = true } = options;
  const cornerMaxDistance = draftTransformCornerSnapRadiusPx / state.camera.zoom;
  const cornerPriorityDistance = draftTransformCornerPriorityRadiusPx / state.camera.zoom;
  let bestCorner = null;
  let bestEdge = null;

  for (let shapeIndex = state.shapes.length - 1; shapeIndex >= 0; shapeIndex -= 1) {
    const shape = state.shapes[shapeIndex];
    const layer = getLayerById(shape.layerId);
    if (!isLayerActuallyVisible(layer)) continue;
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
        if (allowEdge) {
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
    if (!isLayerAvailableForEditing(layer)) continue;

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
  const simplifiedGeometry = simplifyGeometryCollinear(nextGeometry);

  replaceLayerShapes(layerId, createLayerShapeRecordsFromGeometry(layerId, simplifiedGeometry));

  if (affectsSelection) clearSelectionForLayer(layerId);
}

function renderLayersPanel() {
  layersList.innerHTML = "";
  const primaryDrawing = getPrimaryDrawingUi();
  if (primaryDrawing && !state.activeDrawingId) {
    setActiveDrawingById(primaryDrawing.id);
  }

  if (layerSection && layerSectionToggle) {
    layerSection.classList.toggle("collapsed", state.layerSectionCollapsed);
    layerSectionToggle.setAttribute("aria-expanded", String(!state.layerSectionCollapsed));
  }

  for (const drawing of state.drawingsUi) {
    const isExpanded = state.activeDrawingId === drawing.id;
    const drawingCard = document.createElement("div");
    drawingCard.className = "drawing-card" + (isExpanded ? " active-drawing" : " inactive-drawing");

    const drawingGrip = document.createElement("div");
    drawingGrip.className = "drag-handle";
    drawingGrip.textContent = "⋮⋮";
    drawingGrip.title = "Drawing handle";
    drawingGrip.addEventListener("click", (event) => event.stopPropagation());
    drawingGrip.addEventListener("pointerdown", (event) => {
      beginDrawingPointerDrag(event, drawingCard, drawing.id);
    });
    drawingCard.appendChild(drawingGrip);

    const drawingMain = document.createElement("div");
    drawingMain.className = "drawing-main";
    drawingMain.addEventListener("click", () => {
      setActiveDrawingById(drawing.id);
      renderLayersPanel();
      render();
    });

    const drawingHeader = document.createElement("div");
    drawingHeader.className = "card-header";

    const drawingTitleWrap = document.createElement("div");
    drawingTitleWrap.className = "card-header-title";

    let drawingNameField;
    if (state.editingDrawingId === drawing.id) {
      const input = document.createElement("input");
      input.className = "layer-name";
      input.value = state.editingDrawingNameDraft || drawing.name;
      input.size = Math.max(1, input.value.length);
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("pointerdown", (event) => event.stopPropagation());
      input.addEventListener("input", () => {
        state.editingDrawingNameDraft = input.value;
        input.size = Math.max(1, input.value.length);
      });
      input.addEventListener("blur", endRenameDrawing);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          input.blur();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          endRenameDrawing(false);
        }
      });
      queueMicrotask(() => {
        input.focus();
        input.select();
      });
      drawingNameField = input;
    } else {
      const drawingName = document.createElement("div");
      drawingName.className = "layer-name-label";
      drawingName.textContent = drawing.name;
      drawingName.addEventListener("click", (event) => {
        if (!isExpanded) return;
        event.stopPropagation();
        beginRenameDrawing(drawing.id);
      });
      drawingNameField = drawingName;
    }
    drawingTitleWrap.appendChild(drawingNameField);

    const drawingControls = document.createElement("div");
    drawingControls.className = "inline-controls";

    const drawingDuplicate = document.createElement("button");
    drawingDuplicate.className = "inline-icon";
    drawingDuplicate.type = "button";
    drawingDuplicate.title = "Duplicate drawing";
    drawingDuplicate.appendChild(createInlineIcon("duplicate"));
    drawingDuplicate.addEventListener("click", (event) => {
      event.stopPropagation();
      duplicateDrawing(drawing.id);
    });
    drawingControls.appendChild(drawingDuplicate);

    const drawingVisibility = document.createElement("button");
    drawingVisibility.className = "inline-icon visibility-dot";
    drawingVisibility.type = "button";
    drawingVisibility.title = drawing.visible === false ? "Show drawing" : "Hide drawing";
    drawingVisibility.appendChild(createInlineIcon("visibility", { filled: drawing.visible !== false }));
    drawingVisibility.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDrawingVisibility(drawing.id);
    });
    drawingControls.appendChild(drawingVisibility);

    const drawingDelete = document.createElement("button");
    drawingDelete.className = "inline-icon delete-mark";
    drawingDelete.type = "button";
    drawingDelete.title = "Delete drawing";
    drawingDelete.appendChild(createInlineIcon("delete"));
    drawingDelete.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteDrawingById(drawing.id);
    });
    drawingControls.appendChild(drawingDelete);

    drawingHeader.appendChild(drawingTitleWrap);
    drawingHeader.appendChild(drawingControls);
    drawingMain.appendChild(drawingHeader);

    const children = document.createElement("div");
    children.className = "drawing-children";
    children.addEventListener("click", (event) => event.stopPropagation());

    const layersSectionEl = document.createElement("div");
    layersSectionEl.className = "drawing-subsection" + (drawing.layersSectionCollapsed ? " collapsed" : "");

    const layersSubHeader = document.createElement("div");
    layersSubHeader.className = "drawing-subsection-header";

    const layersToggle = document.createElement("button");
    layersToggle.className = "drawing-subsection-toggle";
    layersToggle.type = "button";
    layersToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      drawing.layersSectionCollapsed = !drawing.layersSectionCollapsed;
      renderLayersPanel();
    });

    const layersArrow = document.createElement("span");
    layersArrow.className = "drawing-subsection-toggle-arrow";
    layersArrow.textContent = "▾";

    const layersTitle = document.createElement("span");
    layersTitle.textContent = "Layers";

    layersToggle.appendChild(layersArrow);
    layersToggle.appendChild(layersTitle);

    const layersAddBtn = document.createElement("button");
    layersAddBtn.className = "drawing-subsection-add";
    layersAddBtn.type = "button";
    layersAddBtn.textContent = "+";
    layersAddBtn.title = "Add layer";
    layersAddBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      addLayer(drawing.id);
    });

    layersSubHeader.appendChild(layersToggle);
    layersSubHeader.appendChild(layersAddBtn);
    layersSectionEl.appendChild(layersSubHeader);

    const drawingLayersList = document.createElement("div");
    drawingLayersList.className = "drawing-subsection-list";
    drawingLayersList.dataset.drawingId = drawing.id;

    for (const layer of getLayersForDrawing(drawing.id)) {
      const isActive = layer.id === state.activeLayerId;
      const card = document.createElement("div");
      card.className = "layer-card layer-stack-card" + (isActive ? " active" : "");
      if (!isActive) card.classList.add("inactive-collapsed");

      const grip = document.createElement("div");
      grip.className = "drag-handle";
      grip.textContent = "⋮⋮";
      grip.title = "Layer handle";
      grip.addEventListener("click", (event) => event.stopPropagation());
      grip.addEventListener("pointerdown", (event) => {
        beginLayerPointerDrag(event, card, drawing.id, layer.id);
      });

      const main = document.createElement("div");
      main.className = "layer-main";
      main.addEventListener("click", () => {
        setActiveDrawingById(drawing.id, { layerId: layer.id });
        renderLayersPanel();
        render();
      });

      const header = document.createElement("div");
      header.className = "card-header";

      const titleWrap = document.createElement("div");
      titleWrap.className = "card-header-title";

      let nameField;
      if (state.editingLayerId === layer.id) {
        const input = document.createElement("input");
        input.className = "layer-name";
        input.value = state.editingLayerNameDraft || layer.name;
        input.size = Math.max(1, input.value.length);
        input.addEventListener("click", (event) => event.stopPropagation());
        input.addEventListener("pointerdown", (event) => event.stopPropagation());
        input.addEventListener("input", () => {
          state.editingLayerNameDraft = input.value;
          input.size = Math.max(1, input.value.length);
        });
        input.addEventListener("blur", endRenameLayer);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            input.blur();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            endRenameLayer(false);
          }
        });
        queueMicrotask(() => {
          input.focus();
          input.select();
        });
        nameField = input;
      } else {
        const label = document.createElement("div");
        label.className = "layer-name-label";
        label.textContent = layer.name;
        label.addEventListener("click", (event) => {
          if (state.activeLayerId !== layer.id) return;
          event.stopPropagation();
          beginRenameLayer(layer.id);
        });
        nameField = label;
      }
      titleWrap.appendChild(nameField);

      const inlineControls = document.createElement("div");
      inlineControls.className = "inline-controls";

      const duplicateInline = document.createElement("button");
      duplicateInline.className = "inline-icon";
      duplicateInline.type = "button";
      duplicateInline.title = "Duplicate layer";
      duplicateInline.appendChild(createInlineIcon("duplicate"));
      duplicateInline.addEventListener("click", (event) => {
        event.stopPropagation();
        duplicateLayer(layer.id);
      });
      inlineControls.appendChild(duplicateInline);

      const visibilityInline = document.createElement("button");
      visibilityInline.className = "inline-icon visibility-dot";
      visibilityInline.type = "button";
      visibilityInline.title = layer.visible ? "Hide layer" : "Show layer";
      visibilityInline.appendChild(createInlineIcon("visibility", { filled: layer.visible }));
      visibilityInline.addEventListener("click", (event) => {
        event.stopPropagation();
        layer.visible = !layer.visible;
        renderLayersPanel();
        render();
      });
      inlineControls.appendChild(visibilityInline);

      const removeInline = document.createElement("button");
      removeInline.className = "inline-icon delete-mark";
      removeInline.type = "button";
      removeInline.title = "Delete layer";
      removeInline.appendChild(createInlineIcon("delete"));
      removeInline.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteLayerById(layer.id);
      });
      inlineControls.appendChild(removeInline);

      header.appendChild(titleWrap);
      header.appendChild(inlineControls);
      main.appendChild(header);

      const meta = document.createElement("div");
      meta.className = "layer-meta";
      meta.textContent = getLayerShapeCount(layer.id) + " objects";
      main.appendChild(meta);

      if (layer.locked) {
        const secondaryMeta = document.createElement("div");
        secondaryMeta.className = "layer-meta-secondary";
        secondaryMeta.textContent = "Locked layer";
        main.appendChild(secondaryMeta);
      }

      const opacityField = document.createElement("div");
      opacityField.className = "field";
      opacityField.addEventListener("pointerdown", (event) => event.stopPropagation());
      opacityField.addEventListener("mousedown", (event) => event.stopPropagation());

      const opacityLabel = document.createElement("label");
      opacityLabel.textContent = "Opacity";

      const opacitySlider = document.createElement("input");
      opacitySlider.type = "range";
      opacitySlider.min = "0";
      opacitySlider.max = "100";
      opacitySlider.step = "1";
      opacitySlider.value = String(Math.round((Number.isFinite(layer.opacity) ? layer.opacity : 1) * 100));
      opacitySlider.addEventListener("pointerdown", (event) => event.stopPropagation());
      opacitySlider.addEventListener("mousedown", (event) => event.stopPropagation());
      opacitySlider.addEventListener("click", (event) => event.stopPropagation());
      opacitySlider.addEventListener("input", (event) => {
        layer.opacity = Math.max(0, Math.min(1, Number(event.target.value) / 100));
        render();
      });

      opacityField.appendChild(opacityLabel);
      opacityField.appendChild(opacitySlider);
      main.appendChild(opacityField);

      card.appendChild(grip);
      card.appendChild(main);
      drawingLayersList.appendChild(card);
    }

    layersSectionEl.appendChild(drawingLayersList);
    children.appendChild(layersSectionEl);
    drawingMain.appendChild(children);
    drawingCard.appendChild(drawingMain);
    layersList.appendChild(drawingCard);
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

function addDrawing() {
  state.layerSectionCollapsed = false;
  const bundle = createDrawingWithDefaultLayer();
  bundle.drawing.layersSectionCollapsed = false;
  state.drawingsUi.unshift(bundle.drawing);
  state.layers.push(bundle.layer);
  setActiveDrawingById(bundle.drawing.id, { layerId: bundle.layer.id });
  clearSelection();
  renderLayersPanel();
  render();
}

function duplicateDrawing(drawingId) {
  const drawing = getDrawingUiById(drawingId);
  if (!drawing) return;

  const clone = createDrawingUiRecord(drawing.name + " copy");
  clone.visible = drawing.visible !== false;
  clone.layersSectionCollapsed = drawing.layersSectionCollapsed;

  const sourceLayers = getLayersForDrawingInStorageOrder(drawing.id);
  const layerIdMap = new Map();
  const duplicatedLayers = sourceLayers.map((sourceLayer) => {
    const duplicate = createLayerRecord(clone.id, {
      name: sourceLayer.name,
      visible: sourceLayer.visible,
      locked: sourceLayer.locked,
      fillColor: sourceLayer.fillColor,
      opacity: Number.isFinite(sourceLayer.opacity) ? sourceLayer.opacity : 1,
    });
    layerIdMap.set(sourceLayer.id, duplicate.id);
    return duplicate;
  });

  const duplicatedShapes = state.shapes
    .filter((shape) => layerIdMap.has(shape.layerId))
    .map((shape) => ({
      id: "shape-" + state.nextShapeId++,
      layerId: layerIdMap.get(shape.layerId),
      geometry: cloneGeometry(shape.geometry),
      bounds: cloneBounds(shape.bounds),
    }));

  const drawingIndex = state.drawingsUi.findIndex((entry) => entry.id === drawing.id);
  state.drawingsUi.splice(Math.max(0, drawingIndex), 0, clone);
  state.layers.push(...duplicatedLayers);
  state.shapes.push(...duplicatedShapes);

  const fallbackLayer = getLayersForDrawing(clone.id)[0] || duplicatedLayers[duplicatedLayers.length - 1] || null;
  setActiveDrawingById(clone.id, { layerId: fallbackLayer ? fallbackLayer.id : null });
  clearSelection();
  renderLayersPanel();
  render();
}

function toggleDrawingVisibility(drawingId) {
  const drawing = getDrawingUiById(drawingId);
  if (!drawing) return;
  drawing.visible = drawing.visible === false;
  renderLayersPanel();
  render();
}

function deleteDrawingById(drawingId) {
  const index = state.drawingsUi.findIndex((drawing) => drawing.id === drawingId);
  if (index < 0) return;

  const deletedDrawing = state.drawingsUi[index];
  const deletedLayerIds = new Set(getLayersForDrawingInStorageOrder(drawingId).map((layer) => layer.id));

  state.drawingsUi.splice(index, 1);
  state.layers = state.layers.filter((layer) => !deletedLayerIds.has(layer.id));
  state.shapes = state.shapes.filter((shape) => !deletedLayerIds.has(shape.layerId));

  if (!state.drawingsUi.length) {
    const bundle = createDrawingWithDefaultLayer("Drawing 1");
    bundle.drawing.layersSectionCollapsed = false;
    state.drawingsUi.push(bundle.drawing);
    state.layers.push(bundle.layer);
    setActiveDrawingById(bundle.drawing.id, { layerId: bundle.layer.id });
  } else if (state.activeDrawingId === deletedDrawing.id || deletedLayerIds.has(state.activeLayerId)) {
    const fallbackDrawing = state.drawingsUi[Math.max(0, index - 1)] || state.drawingsUi[0];
    const fallbackLayer = fallbackDrawing ? getDrawingLayerFallback(fallbackDrawing.id) : null;
    setActiveDrawingById(fallbackDrawing.id, { layerId: fallbackLayer ? fallbackLayer.id : null });
  } else {
    setActiveDrawingById(getActiveDrawingUi().id, { layerId: state.activeLayerId });
  }

  if (state.editingDrawingId === drawingId) {
    state.editingDrawingId = null;
    state.editingDrawingNameDraft = "";
    state.editingDrawingInitialName = "";
  }
  if (state.editingLayerId && deletedLayerIds.has(state.editingLayerId)) {
    state.editingLayerId = null;
    state.editingLayerNameDraft = "";
    state.editingLayerInitialName = "";
  }

  clearSelection();
  renderLayersPanel();
  render();
}

function duplicateLayer(layerId) {
  const index = state.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return;

  const sourceLayer = state.layers[index];
  const duplicatedLayerId = "layer-" + state.nextLayerId;
  state.nextLayerId += 1;

  const duplicatedLayer = {
    ...sourceLayer,
    id: duplicatedLayerId,
    name: sourceLayer.name + " copy",
    opacity: Number.isFinite(sourceLayer.opacity) ? sourceLayer.opacity : 1,
  };

  state.layers.splice(index + 1, 0, duplicatedLayer);

  const duplicatedShapes = state.shapes
    .filter((shape) => shape.layerId === layerId)
    .map((shape) => ({
      id: "shape-" + state.nextShapeId++,
      layerId: duplicatedLayerId,
      geometry: cloneGeometry(shape.geometry),
      bounds: cloneBounds(shape.bounds),
    }));

  state.shapes.push(...duplicatedShapes);
  setActiveDrawingById(getLayerDrawingId(duplicatedLayer), { layerId: duplicatedLayerId });
  clearSelection();
  renderLayersPanel();
  render();
}

function addLayer(drawingId = getPrimaryDrawingUi().id) {
  const drawing = getDrawingUiById(drawingId) || getPrimaryDrawingUi();
  const layer = createLayerRecord(drawing.id);
  state.layers.push(layer);
  drawing.layersSectionCollapsed = false;
  setActiveDrawingById(drawing.id, { layerId: layer.id });
  clearSelection();
  renderLayersPanel();
  render();
}

function deleteLayerById(layerId) {
  const index = state.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return;

  const deletedLayer = state.layers[index];
  const drawingId = getLayerDrawingId(deletedLayer);
  const drawingLayers = getLayersForDrawingInStorageOrder(drawingId);
  if (drawingLayers.length <= 1) return;

  const deletedId = deletedLayer.id;
  state.layers.splice(index, 1);
  state.shapes = state.shapes.filter((shape) => shape.layerId !== deletedId);

  if (state.editingLayerId === deletedId) {
    state.editingLayerId = null;
    state.editingLayerNameDraft = "";
    state.editingLayerInitialName = "";
  }

  if (state.activeLayerId === deletedId) {
    const fallback = getDrawingLayerFallback(drawingId);
    setActiveDrawingById(drawingId, { layerId: fallback ? fallback.id : null });
  }

  clearSelection();
  renderLayersPanel();
  render();
}

function deleteActiveLayer() {
  deleteLayerById(state.activeLayerId);
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

function getSurfaceDisplaySize(surface) {
  const rect = surface.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width || surface.clientWidth || window.innerWidth)),
    height: Math.max(1, Math.round(rect.height || surface.clientHeight || window.innerHeight)),
  };
}

function resizeSurfaceToDisplaySize(surface, context, dpr) {
  const { width, height } = getSurfaceDisplaySize(surface);
  surface.width = Math.floor(width * dpr);
  surface.height = Math.floor(height * dpr);
  surface.style.width = width + "px";
  surface.style.height = height + "px";
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
}

function getCanvasViewportSize() {
  return getSurfaceDisplaySize(canvas);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = resizeSurfaceToDisplaySize(canvas, ctx, dpr);
  for (const { surface, context } of draftRulerSurfaces) {
    resizeSurfaceToDisplaySize(surface, context, dpr);
  }

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
  const zoom = state.camera.zoom;
  const cos = draftRotation.cos;
  const sin = draftRotation.sin;
  const originX = state.draftOrigin.x;
  const originY = state.draftOrigin.y;

  // Keep the render transform numerically identical to worldToDraft/draftToWorld.
  targetCtx.transform(
    zoom * cos,
    -zoom * sin,
    zoom * sin,
    zoom * cos,
    state.camera.x + zoom * (-originX * cos - originY * sin),
    state.camera.y + zoom * (originX * sin - originY * cos)
  );
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

  const dx = endSnap.world.x - startSnap.world.x;
  const dy = endSnap.world.y - startSnap.world.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;

  const currentAlignAngleRad = Math.atan2(dy, dx);
  const currentAlignAngleDeg = (currentAlignAngleRad * 180) / Math.PI;

  console.log('--- NEW ALIGN EVENT ---');
  console.log('Align Angle (Deg):', currentAlignAngleDeg.toFixed(15));
  console.log('Align Vector (DX, DY):', dx.toFixed(15), dy.toFixed(15));
  console.log('Align Raw Input To Draft Angle (DX, DY):', dx.toFixed(15), dy.toFixed(15));

  state.draftOrigin = cloneDraftPoint(startSnap.world);
  setDraftAngleFromAlignedDirection(dx, dy);
  logActiveDraftAngleTable("Align Active Draft Angle Table");
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
  updateGridStatus();
  render();
}

function rotateDraftAngle(stepDelta) {
  if (!Number.isFinite(stepDelta) || !stepDelta) return;
  draftAngleStore.rotateStep(stepDelta);
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
  const renderableLayers = getRenderableLayersInPaintOrder();

  for (let layerIndex = renderableLayers.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const layer = renderableLayers[layerIndex];
    if (!isLayerAvailableForEditing(layer)) continue;

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
      return isLayerAvailableForEditing(layer);
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
    if (!isLayerActuallyVisible(selectedLayer)) continue;

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
  ctx.globalAlpha = Math.max(0, Math.min(1, Number.isFinite(layer.opacity) ? layer.opacity : 1));

  for (const shape of layerShapes) {
    ctx.beginPath();
    traceGeometryPath(ctx, shape.geometry);
    ctx.fillStyle = layer.fillColor;
    ctx.fill("evenodd");
    ctx.strokeStyle = outlineStrokeColor;
    ctx.lineWidth = 1 / state.camera.zoom;
    ctx.stroke();

    ctx.beginPath();
    drawGeometryVertices(ctx, shape.geometry);
    ctx.fillStyle = outlineStrokeColor;
    ctx.fill();
  }

  ctx.restore();
}

function drawGrid() {
  const metrics = getVisibleGridMetrics();
  const zoom = state.camera.zoom;
  const { width, height } = getCanvasViewportSize();
  const draftLeft = (0 - state.camera.x) / zoom;
  const draftRight = (width - state.camera.x) / zoom;
  const draftTop = (0 - state.camera.y) / zoom;
  const draftBottom = (height - state.camera.y) / zoom;
  const minorStep = metrics.visibleStep;
  const midStep = metrics.midStep;
  const majorStep = metrics.majorStep;
  const minorOpacity = getGridTierOpacity(minorStep * zoom);
  const midOpacity = getGridTierOpacity(midStep * zoom);
  const majorOpacity = getGridTierOpacity(majorStep * zoom);
  const epsilon = 1e-9;

  function isAxisCoordinate(value) {
    return Math.abs(value) <= epsilon;
  }

  function drawVerticalLines(step, strokeStyle, opacity = 1, shouldSkip = null) {
    if (opacity <= 0) return;
    if ((draftRight - draftLeft) / step > maxGridLinesPerAxis) return;
    ctx.save();
    ctx.globalAlpha = opacity;
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
    ctx.restore();
  }

  function drawHorizontalLines(step, strokeStyle, opacity = 1, shouldSkip = null) {
    if (opacity <= 0) return;
    if ((draftBottom - draftTop) / step > maxGridLinesPerAxis) return;
    ctx.save();
    ctx.globalAlpha = opacity;
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
    ctx.restore();
  }

  function isMidOrMajorCoordinate(value) {
    const cellIndex = Math.round(value / minorStep);
    return cellIndex % metrics.midEvery === 0;
  }

  function isMajorCoordinate(value) {
    const cellIndex = Math.round(value / minorStep);
    return cellIndex % metrics.majorEvery === 0;
  }

  ctx.save();
  ctx.lineWidth = 1;
  drawVerticalLines(minorStep, gridMinorStrokeColor, minorOpacity, (x) => isAxisCoordinate(x) || isMidOrMajorCoordinate(x));
  drawHorizontalLines(minorStep, gridMinorStrokeColor, minorOpacity, (y) => isAxisCoordinate(y) || isMidOrMajorCoordinate(y));
  drawVerticalLines(midStep, gridMidStrokeColor, midOpacity, (x) => isAxisCoordinate(x) || isMajorCoordinate(x));
  drawHorizontalLines(midStep, gridMidStrokeColor, midOpacity, (y) => isAxisCoordinate(y) || isMajorCoordinate(y));
  drawVerticalLines(majorStep, gridMajorStrokeColor, majorOpacity, isAxisCoordinate);
  drawHorizontalLines(majorStep, gridMajorStrokeColor, majorOpacity, isAxisCoordinate);

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

function formatDraftRulerLabel(valueMm) {
  return formatLengthValue(valueMm, state.settings.displayUnit);
}

function getDraftRulerLabelFont(major, mid) {
  if (major) return "600 10px IBM Plex Sans, Segoe UI, sans-serif";
  if (mid) return "10px IBM Plex Sans, Segoe UI, sans-serif";
  return "9px IBM Plex Sans, Segoe UI, sans-serif";
}

function reserveHorizontalRulerLabel(context, x, labelText, font, labelState) {
  context.font = font;
  const labelWidth = context.measureText(labelText).width;
  const start = x + 4;
  const end = start + labelWidth;
  if (start <= labelState.lastEnd + rulerLabelPaddingPx) return null;
  labelState.lastEnd = end;
  return labelText;
}

function reserveVerticalRulerLabel(context, y, labelText, font, labelState) {
  context.font = font;
  const labelExtent = context.measureText(labelText).width;
  const start = y - labelExtent / 2;
  const end = y + labelExtent / 2;
  if (start <= labelState.lastEnd + rulerLabelPaddingPx) return null;
  labelState.lastEnd = end;
  return labelText;
}

function drawHorizontalDraftRulerMark(context, x, major, mid, invert, labelText, thickness, colors) {
  const tick = major ? 7 : mid ? 11 : 16;
  context.beginPath();
  context.moveTo(x + 0.5, invert ? 0 : thickness);
  context.lineTo(x + 0.5, invert ? thickness - tick : tick);
  context.strokeStyle = major ? colors.major : mid ? colors.mid : colors.minor;
  context.lineWidth = major ? 0.56 : mid ? 0.4 : 0.26;
  context.stroke();

  if (!labelText) return;
  context.fillStyle = colors.text;
  context.font = getDraftRulerLabelFont(major, mid);
  context.fillText(labelText, x + 4, invert ? thickness - 8 : 9);
}

function drawVerticalDraftRulerMark(context, y, major, mid, invert, labelText, thickness, colors) {
  const tick = major ? 8 : mid ? 11 : 16;
  context.beginPath();
  context.moveTo(invert ? 0 : thickness, y + 0.5);
  context.lineTo(invert ? thickness - tick : tick, y + 0.5);
  context.strokeStyle = major ? colors.major : mid ? colors.mid : colors.minor;
  context.lineWidth = major ? 0.56 : mid ? 0.4 : 0.26;
  context.stroke();

  if (!labelText) return;
  context.save();
  context.translate(invert ? thickness - 8 : 9, y);
  context.rotate(-Math.PI / 2);
  context.fillStyle = colors.text;
  context.font = getDraftRulerLabelFont(major, mid);
  context.fillText(labelText, 4, 0);
  context.restore();
}

function drawDraftRulers() {
  const metrics = getAdaptiveGridMetrics();
  const topWidth = Math.round(draftRulerTop.clientWidth);
  const leftHeight = Math.round(draftRulerLeft.clientHeight);
  const topThickness = Math.round(draftRulerTop.clientHeight);
  const leftThickness = Math.round(draftRulerLeft.clientWidth);
  const bottomThickness = Math.round(draftRulerBottom.clientHeight);
  const rightThickness = Math.round(draftRulerRight.clientWidth);
  const colors = {
    background: getCssTokenValue("--ruler-bg"),
    text: getCssTokenValue("--muted"),
    minor: "rgb(8, 12, 16)",
    mid: "rgb(8, 12, 16)",
    major: "rgb(8, 12, 16)",
  };

  for (const { surface, context } of draftRulerSurfaces) {
    const { width, height } = getSurfaceDisplaySize(surface);
    context.clearRect(0, 0, width, height);
    context.fillStyle = colors.background;
    context.fillRect(0, 0, width, height);
    context.textAlign = "left";
    context.textBaseline = "middle";
  }

  const step = metrics.visibleStepPx;
  if (step <= 1) return;

  const horizontalStart = state.camera.x % step;
  const verticalStart = state.camera.y % step;
  const horizontalLabelState = { lastEnd: -Infinity };
  const verticalLabelState = { lastEnd: -Infinity };

  for (let x = horizontalStart; x <= topWidth; x += step) {
    const cellIndex = Math.round((x - state.camera.x) / step);
    const major = cellIndex % metrics.majorEvery === 0;
    const mid = !major && cellIndex % metrics.midEvery === 0;
    const labelValueMm = cellIndex * metrics.visibleStep;
    const labelText =
      cellIndex % metrics.labelEvery === 0
        ? reserveHorizontalRulerLabel(
            draftRulerTopCtx,
            x,
            formatDraftRulerLabel(labelValueMm),
            getDraftRulerLabelFont(major, mid),
            horizontalLabelState
          )
        : null;
    drawHorizontalDraftRulerMark(
      draftRulerTopCtx,
      x,
      major,
      mid,
      false,
      labelText,
      topThickness,
      colors
    );
    drawHorizontalDraftRulerMark(
      draftRulerBottomCtx,
      x,
      major,
      mid,
      true,
      labelText,
      bottomThickness,
      colors
    );
  }

  for (let y = verticalStart; y <= leftHeight; y += step) {
    const cellIndex = Math.round((y - state.camera.y) / step);
    const major = cellIndex % metrics.majorEvery === 0;
    const mid = !major && cellIndex % metrics.midEvery === 0;
    const labelValueMm = -cellIndex * metrics.visibleStep;
    const labelText =
      cellIndex % metrics.labelEvery === 0
        ? reserveVerticalRulerLabel(
            draftRulerLeftCtx,
            y,
            formatDraftRulerLabel(labelValueMm),
            getDraftRulerLabelFont(major, mid),
            verticalLabelState
          )
        : null;
    drawVerticalDraftRulerMark(
      draftRulerLeftCtx,
      y,
      major,
      mid,
      false,
      labelText,
      leftThickness,
      colors
    );
    drawVerticalDraftRulerMark(
      draftRulerRightCtx,
      y,
      major,
      mid,
      true,
      labelText,
      rightThickness,
      colors
    );
  }
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

function drawInfiniteDraftAlignCross(originWorld, targetWorld) {
  if (!originWorld || !targetWorld) return;

  const originScreen = worldToScreen(originWorld);
  const targetScreen = worldToScreen(targetWorld);
  const dx = targetScreen.x - originScreen.x;
  const dy = targetScreen.y - originScreen.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return;

  const ux = dx / length;
  const uy = dy / length;
  const vx = -uy;
  const vy = ux;
  const lineExtent = Math.hypot(canvas.width, canvas.height);

  ctx.save();
  ctx.strokeStyle = "rgba(245, 158, 11, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);

  ctx.beginPath();
  ctx.moveTo(originScreen.x - ux * lineExtent, originScreen.y - uy * lineExtent);
  ctx.lineTo(originScreen.x + ux * lineExtent, originScreen.y + uy * lineExtent);
  ctx.moveTo(originScreen.x - vx * lineExtent, originScreen.y - vy * lineExtent);
  ctx.lineTo(originScreen.x + vx * lineExtent, originScreen.y + vy * lineExtent);
  ctx.stroke();
  ctx.restore();
}

function drawDraftTransformPreview() {
  if (!state.spacePressed || !state.pointerInCanvas || state.panning || state.draggingDraftOrigin) return;

  const hoverSnap = state.draggingDraftAlign
    ? state.draftAlignCurrentSnap
    : getDraftTransformSnapTarget(state.current, undefined, { allowEdge: false });
  const startSnap = state.draggingDraftAlign ? state.draftAlignStartSnap : null;

  if (!hoverSnap && !startSnap) return;

  ctx.save();

  if (startSnap) {
    drawDraftAlignStartMarker(startSnap.world);

    if (hoverSnap && distanceBetweenPoints(startSnap.world, hoverSnap.world) > 1e-6) {
      drawInfiniteDraftAlignCross(startSnap.world, hoverSnap.world);
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
  if (!isLayerAvailableForEditing(activeLayer)) return;

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
  const { width, height } = getCanvasViewportSize();
  ctx.clearRect(0, 0, width, height);
  drawGrid();

  for (const layer of getRenderableLayersInPaintOrder()) {
    if (!isLayerActuallyVisible(layer)) continue;
    drawLayerMerged(layer);
  }

  const activeLayer = getActiveLayer();
  if (state.dragging && state.tool === "draw" && isLayerAvailableForEditing(activeLayer)) {
    const draft = state.draftShape;
    if (draft && !draft.small) drawLayerPreview(draft, activeLayer, state.drawOperation);
  }

  renderSelectOverlay();
  renderSelectionBoxOverlay();
  drawDraftTransformPreview();
  drawSnapPreview();
  drawDraftRulers();
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
      const startSnap = getDraftTransformSnapTarget(world, undefined, { allowEdge: false });
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
  if (state.tool === "draw" && !isLayerAvailableForEditing(activeLayer)) return;

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
      renderLayersPanel();
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
      renderLayersPanel();
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
  const { width, height } = getCanvasViewportSize();
  zoomAtScreenPoint(state.camera.zoom * 1.15, {
    x: width / 2,
    y: height / 2,
  });
});
zoomOutBtn.addEventListener("click", () => {
  const { width, height } = getCanvasViewportSize();
  zoomAtScreenPoint(state.camera.zoom * 0.85, {
    x: width / 2,
    y: height / 2,
  });
});

if (settingsButton) {
  settingsButton.addEventListener("click", () => {
    if (isSettingsMenuOpen()) {
      closeSettingsMenu();
      return;
    }

    openSettingsMenu();
  });
}

if (settingsCloseButton) {
  settingsCloseButton.addEventListener("click", () => {
    closeSettingsMenu();
  });
}

if (settingsApplyButton) {
  settingsApplyButton.addEventListener("click", () => {
    applySettingsDraft();
    closeSettingsMenu();
  });
}

if (modalBackdrop) {
  modalBackdrop.addEventListener("click", () => {
    closeSettingsMenu();
  });
}

for (const button of settingsDisplayUnitButtons) {
  button.addEventListener("click", () => {
    if (!state.settingsDraft) return;
    state.settingsDraft.displayUnit = sanitizeMeasurementUnit(button.dataset.settingsDisplayUnit, state.settingsDraft.displayUnit);
    syncSettingsMenu();
  });
}

for (const button of settingsCellUnitButtons) {
  button.addEventListener("click", () => {
    if (!state.settingsDraft) return;
    if (state.settingsDraft.snapMode === "adaptive") return;
    state.settingsDraft.cellUnit = sanitizeMeasurementUnit(button.dataset.settingsCellUnit, state.settingsDraft.cellUnit);
    syncSettingsMenu();
  });
}

for (const button of settingsSnapModeButtons) {
  button.addEventListener("click", () => {
    if (!state.settingsDraft) return;
    state.settingsDraft.snapMode = sanitizeGridSnapMode(button.dataset.settingsSnapMode, state.settingsDraft.snapMode);
    syncSettingsMenu();
  });
}

if (settingsCellSizeInput) {
  settingsCellSizeInput.addEventListener("input", () => {
    if (!state.settingsDraft) return;
    if (settingsCellSizeInput.value.trim() === "") return;
    state.settingsDraft.cellSize = sanitizeCellSize(settingsCellSizeInput.value, state.settingsDraft.cellSize);
  });
}

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
  const iconButton = e.target.closest(".inline-icon, .drawing-subsection-toggle, .drawing-subsection-add");
  if (iconButton) return;
});

if (layerFillInput) {
  layerFillInput.addEventListener("input", (e) => {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    activeLayer.fillColor = e.target.value;
    renderLayersPanel();
    render();
  });
}

if (layerSectionToggle) {
  layerSectionToggle.addEventListener("click", () => {
    state.layerSectionCollapsed = !state.layerSectionCollapsed;
    renderLayersPanel();
  });
}

if (layerAddBtn) {
  layerAddBtn.addEventListener("click", () => addLayer(getPrimaryDrawingUi().id));
}

if (addDrawingBtn) {
  addDrawingBtn.addEventListener("click", () => {
    state.layerSectionCollapsed = false;
    addDrawing();
  });
}

window.addEventListener("pointermove", (event) => {
  const drag = state.leftPanelPointerDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;

  const drop =
    drag.type === "drawing"
      ? drawingDropPositionFromClientY(event.clientY, drag.drawingId)
      : layerDropPositionFromClientY(drag.drawingId, event.clientY, drag.layerId);
  drag.dropIndex = drop.toIndex;
  drag.rawIndex = drop.rawIndex;
  drag.fromIndex = drop.fromIndex;
  if (drag.type === "drawing") {
    updateDrawingDropIndicator(drop.rawIndex, drop.toIndex, drop.fromIndex);
  } else {
    updateLayerDropIndicator(drag.drawingId, drop.rawIndex, drop.toIndex, drop.fromIndex);
  }
});

window.addEventListener("pointerup", (event) => {
  const drag = state.leftPanelPointerDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  clearLeftPanelPointerDrag(true);
});

window.addEventListener("pointercancel", (event) => {
  const drag = state.leftPanelPointerDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  clearLeftPanelPointerDrag(false);
});

window.addEventListener("blur", () => {
  if (state.leftPanelPointerDrag) clearLeftPanelPointerDrag(false);
});

window.addEventListener("keydown", (e) => {
  if (isSettingsMenuOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSettingsMenu();
    }
    return;
  }

  if (e.key === "Escape" && state.leftPanelPointerDrag) {
    clearLeftPanelPointerDrag(false);
    return;
  }

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
  if (isSettingsMenuOpen()) return;

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
updateGridStatus();
updateWorkplaneStatus();
updateCursor();
renderLayersPanel();
syncDrawSizeInput();
syncSettingsMenu();
resizeCanvas();

// Debugging Expose
window.state = state;
window.getActiveDraftAngleRotation = getActiveDraftAngleRotation;
window.draftAngleStore = draftAngleStore;
window.getDraftAngleSnapshot = () => draftAngleStore.getSnapshot();
window.renderLiveRegistry = renderLiveRegistry;
