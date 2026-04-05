import { ClipType, FillRule, PolyTree64, booleanOpWithPolyTree, isPositive, simplifyPaths } from "clipper2-ts";
import {
  createDraftAngleStore,
  DEFAULT_DRAFT_ANGLE_FAMILY_ID,
  normalizeDegrees360,
  normalizeDraftAngleStep,
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
const exportButton = document.getElementById("exportButton");
const importButton = document.getElementById("importButton");
const layerSettingsButton = document.getElementById("layerSettingsButton");
const renderSettingsButton = document.getElementById("renderSettingsButton");
const settingsMenu = document.getElementById("settingsMenu");
const exportFallbackMenu = document.getElementById("exportFallbackMenu");
const layerSettingsModal = document.getElementById("layerSettingsModal");
const renderSettingsModal = document.getElementById("renderSettingsModal");
const renderBoxPropertiesModal = document.getElementById("renderBoxPropertiesModal");
const settingsCloseButton = document.getElementById("settingsCloseButton");
const settingsApplyButton = document.getElementById("settingsApplyButton");
const exportFallbackCloseButton = document.getElementById("exportFallbackCloseButton");
const layerSettingsCloseButton = document.getElementById("layerSettingsCloseButton");
const layerSettingsApplyButton = document.getElementById("layerSettingsApplyButton");
const renderSettingsCloseButton = document.getElementById("renderSettingsCloseButton");
const renderSettingsApplyButton = document.getElementById("renderSettingsApplyButton");
const renderBoxPropertiesTarget = document.getElementById("renderBoxPropertiesTarget");
const renderBoxPropertiesHeightInput = document.getElementById("renderBoxPropertiesHeightInput");
const renderBoxPropertiesStartInput = document.getElementById("renderBoxPropertiesStartInput");
const renderBoxPropertiesEndInput = document.getElementById("renderBoxPropertiesEndInput");
const renderBoxPropertiesCloseButton = document.getElementById("renderBoxPropertiesCloseButton");
const renderBoxPropertiesApplyButton = document.getElementById("renderBoxPropertiesApplyButton");
const renderDepthStrengthDecrease = document.getElementById("renderDepthStrengthDecrease");
const renderDepthStrengthIncrease = document.getElementById("renderDepthStrengthIncrease");
const renderDepthStrengthValue = document.getElementById("renderDepthStrengthValue");
const renderOutlineColorInput = document.getElementById("renderOutlineColorInput");
const renderOutlineWidthInput = document.getElementById("renderOutlineWidth");
const settingsCellSizeInput = document.getElementById("settingsCellSizeInput");
const settingsOutlineColorInput = document.getElementById("settingsOutlineColorInput");
const settingsOutlineSwatch = document.getElementById("settingsOutlineSwatch");
const modalBackdrop = document.getElementById("modalBackdrop");
const draftRulerTop = document.getElementById("draft-ruler-top");
const draftRulerLeft = document.getElementById("draft-ruler-left");
const draftRulerBottom = document.getElementById("draft-ruler-bottom");
const draftRulerRight = document.getElementById("draft-ruler-right");
const layersPanel = document.getElementById("layersPanel");
const canvasShell = document.querySelector(".canvas-shell");
const layerSection = document.getElementById("layerSection");
const layerSectionToggle = document.getElementById("layerSectionToggle");
const layersList = document.getElementById("layers-list");
const renderSection = document.getElementById("renderSection");
const renderSectionToggle = document.getElementById("renderSectionToggle");
const rendersList = document.getElementById("renders-list");
const layerAddBtn = document.getElementById("addLayerButton");
const addDrawingBtn = document.getElementById("addDrawingButton");
const addRenderBtn = document.getElementById("addRenderButton");
const layerFillInput = document.getElementById("layer-fill");
const layerSettingsColumnHeadings = document.getElementById("layerSettingsColumnHeadings");
const layerSettingsBody = document.getElementById("layerSettingsBody");
const layerSettingsDrawingList = document.getElementById("layerSettingsDrawingList");
const layerSettingsEmptyState = document.getElementById("layerSettingsEmptyState");
const projectImportInput = document.getElementById("projectImportInput");
const workspaceSwitcher = document.getElementById("workspaceSwitcher");
const renderWorkspaceShell = document.getElementById("renderWorkspaceShell");
const renderLayoutButtons = Array.from(document.querySelectorAll("[data-render-layout]"));
const renderOutputGrid = document.getElementById("renderOutputGrid");
const renderPaneSlots = Array.from(document.querySelectorAll(".render-pane[data-render-slot]"));
const renderPaneTitles = renderPaneSlots.map((pane) => pane.querySelector(".render-pane-title"));
const renderPaneEmptyStates = renderPaneSlots.map((pane) => pane.querySelector(".render-pane-empty"));
const renderPaneCanvases = renderPaneSlots.map((pane) => pane.querySelector(".render-pane-canvas"));
const renderPaneSectionButtonRows = renderPaneSlots.map((pane) => pane.querySelector(".render-pane-section-buttons"));
const renderPaneExportButtons = Array.from(document.querySelectorAll("[data-render-export-slot][data-render-export-format]"));
const renderPaneSelectorButtons = Array.from(document.querySelectorAll("[data-render-slot][data-render-direction]"));
const renderSyncFitButton = document.getElementById("renderSyncFitButton");
const renderPopoutButton = document.getElementById("renderPopoutButton");
const renderPopoutNotice = document.getElementById("renderPopoutNotice");
const renderLayoutToolbar = document.querySelector(".render-layout-toolbar");
const settingsDisplayUnitButtons = Array.from(document.querySelectorAll("[data-settings-display-unit]"));
const settingsCellUnitButtons = Array.from(document.querySelectorAll("[data-settings-cell-unit]"));
const settingsSnapModeButtons = Array.from(document.querySelectorAll("[data-settings-snap-mode]"));
const settingsAlignSnapButtons = Array.from(document.querySelectorAll("[data-settings-align-snap]"));
const settingsOutlineButtons = Array.from(document.querySelectorAll("[data-settings-outline-enabled]"));
const settingsCornersButtons = Array.from(document.querySelectorAll("[data-settings-corners-enabled]"));
const renderDepthModeButtons = Array.from(document.querySelectorAll("[data-render-depth-mode]"));
const renderOutlineButtons = Array.from(document.querySelectorAll("[data-render-outline]"));

const defaultOutlineStrokeColor = "#0f172a";
const hiddenOutlineVertexColor = "#9ca3af";
const PROJECT_FILE_APP_ID = "millimetre";
const PROJECT_FILE_VERSION = 1;
const DEFAULT_PROJECT_FILE_NAME = "millimetre-project.json";
const DEFAULT_ACTIVE_WORKSPACE_TAB = Object.freeze({ kind: "main" });
const STANDARD_RENDER_DIRECTIONS = Object.freeze(["topToBottom", "bottomToTop", "leftToRight", "rightToLeft", "plan"]);
const DEFAULT_RENDER_PANE_DIRECTIONS = Object.freeze(["topToBottom", "bottomToTop", "leftToRight", "rightToLeft"]);
const STANDARD_RENDER_LAYOUT_PRESETS = Object.freeze([1, 2, 4]);
const DEFAULT_RENDER_PANE_DIRECTION_PROFILES = Object.freeze({
  1: Object.freeze([...DEFAULT_RENDER_PANE_DIRECTIONS]),
  2: Object.freeze([...DEFAULT_RENDER_PANE_DIRECTIONS]),
  4: Object.freeze([...DEFAULT_RENDER_PANE_DIRECTIONS]),
});
const DEFAULT_RENDER_VOLUME = Object.freeze({
  baseElevationMm: 0,
  heightMm: 0,
});
const DEFAULT_RENDER_SYNC_FIT = false;
const DEFAULT_LAYER_RENDER = Object.freeze({
  enabled: true,
  baseElevationMm: 0,
  heightMm: 0,
  role: null,
});
const DEFAULT_LAYER_SETTINGS_UI_MEMORY = Object.freeze({
  collapsedByDrawingId: Object.freeze({}),
  scrollTop: 0,
});
const DEFAULT_RENDER_DEPTH_EFFECT = Object.freeze({
  enabled: true,
  strength: 100,
  mode: "shadow",
});
const DEFAULT_RENDER_OUTLINE_EFFECT = Object.freeze({
  enabled: true,
  thickness: 2,
  color: "#111827",
});
const DEFAULT_RENDER_SETTINGS = Object.freeze({
  depthEffect: DEFAULT_RENDER_DEPTH_EFFECT,
  outlineEffect: DEFAULT_RENDER_OUTLINE_EFFECT,
});
const RENDER_POPOUT_QUERY_PARAM = "renderPopout";
const RENDER_POPOUT_RENDER_ID_QUERY_PARAM = "renderId";
const RENDER_POPOUT_TOKEN_QUERY_PARAM = "token";
const RENDER_POPOUT_WINDOW_NAME = "millimetre-render-popout";
const RENDER_POPOUT_MIRROR_STORAGE_PREFIX = "millimetre-render-popout-snapshot:";
const RENDER_POPOUT_CHANNEL_PREFIX = "millimetre-render-popout-channel:";
const DEFAULT_SETTINGS = Object.freeze({
  displayUnit: "m",
  cellUnit: "cm",
  cellSize: 5,
  snapMode: "adaptive",
  alignSnap: 90,
  outlineEnabled: true,
  outlineColor: defaultOutlineStrokeColor,
  cornersEnabled: true,
});

const state = {
  tool: "draw",
  shapeType: "rect",
  shapes: [],
  drawingsUi: [{ id: "drawing-1", name: "Drawing 1", expanded: true, visible: true, layersSectionCollapsed: false }],
  layerSectionCollapsed: false,
  renderSectionCollapsed: false,
  layers: [
    {
      id: "layer-1",
      drawingId: "drawing-1",
      name: "Layer 1",
      visible: true,
      locked: false,
      fillColor: "#93c5fd",
      opacity: 1,
      render: { ...DEFAULT_LAYER_RENDER },
    },
  ],
  renders: [],
  activeDrawingId: "drawing-1",
  activeLayerId: "layer-1",
  activeRenderId: null,
  renderTransformDrag: null,
  activeWorkspaceTab: { ...DEFAULT_ACTIVE_WORKSPACE_TAB },
  renderLayoutPreset: 1,
  renderPaneDirectionProfiles: {
    1: [...DEFAULT_RENDER_PANE_DIRECTIONS],
    2: [...DEFAULT_RENDER_PANE_DIRECTIONS],
    4: [...DEFAULT_RENDER_PANE_DIRECTIONS],
  },
  nextDrawingId: 2,
  editingDrawingId: null,
  editingDrawingNameDraft: "",
  editingDrawingInitialName: "",
  editingLayerId: null,
  editingLayerNameDraft: "",
  editingLayerInitialName: "",
  editingRenderId: null,
  editingRenderNameDraft: "",
  editingRenderInitialName: "",
  nextLayerId: 2,
  nextShapeId: 1,
  nextRenderId: 1,
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
  layerSettingsPointerDrag: null,
  draftOriginDragStartScreen: { x: 0, y: 0 },
  draftOriginDragStartOrigin: { x: 0, y: 0 },
  draftOriginDragRotation: null,
  pendingRenderBox: null,
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
  renderSettings: {
    depthEffect: { ...DEFAULT_RENDER_DEPTH_EFFECT },
    outlineEffect: { ...DEFAULT_RENDER_OUTLINE_EFFECT },
  },
  renderSettingsDraft: null,
  renderBoxPropertiesDraft: null,
  layerSettingsDraft: null,
  layerSettingsUi: {
    collapsedByDrawingId: {},
    scrollTop: 0,
  },
  projectFileName: DEFAULT_PROJECT_FILE_NAME,
  exportFallbackNoticeShown: false,
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

function isRenderPopoutWindow() {
  return renderPopoutSession.mode === "popout";
}

function isRenderPopoutMainController() {
  return renderPopoutSession.mode === "main";
}

function getTrackedRenderPopoutId() {
  return isRenderPopoutWindow() ? renderPopoutSession.targetRenderId : renderPopoutSession.openRenderId;
}

function isRenderExternalized(renderId) {
  if (isRenderPopoutWindow()) return false;
  if (!renderId) return false;
  return renderPopoutSession.openRenderId === renderId;
}

function generateRenderPopoutToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rpop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureRenderPopoutChannel() {
  if (!renderPopoutSession.channelName) return null;
  if (renderPopoutSession.channel) return renderPopoutSession.channel;
  if (typeof BroadcastChannel !== "function") return null;
  const channel = new BroadcastChannel(renderPopoutSession.channelName);
  if (isRenderPopoutWindow()) {
    channel.addEventListener("message", (event) => {
      const message = isPlainObject(event.data) ? event.data : null;
      if (!message) return;
      if (message.type === "mirror-state" && isPlainObject(message.payload)) {
        applyRenderPopoutMirrorPayload(message.payload);
        return;
      }
      if (message.type === "close-window") {
        try {
          window.close();
        } catch {}
      }
    });
  }
  renderPopoutSession.channel = channel;
  return channel;
}

function closeRenderPopoutChannel() {
  if (!renderPopoutSession.channel) return;
  renderPopoutSession.channel.close();
  renderPopoutSession.channel = null;
}

function captureRenderPopoutMirrorPayload(renderId = getTrackedRenderPopoutId()) {
  const payload = createProjectFilePayload();
  if (renderId) {
    payload.workspace.activeWorkspaceTab = { kind: "render", renderId };
  }
  return payload;
}

function persistRenderPopoutMirrorPayload(payload) {
  if (!renderPopoutSession.snapshotKey) return;
  try {
    localStorage.setItem(renderPopoutSession.snapshotKey, JSON.stringify(payload));
  } catch {}
}

function clearPersistedRenderPopoutMirrorPayload() {
  if (!renderPopoutSession.snapshotKey) return;
  try {
    localStorage.removeItem(renderPopoutSession.snapshotKey);
  } catch {}
}

function captureRenderPopoutLocalUiState() {
  if (!isRenderPopoutWindow()) return null;
  const renderId = getTrackedRenderPopoutId();
  const renderRecord = renderId ? getRenderById(renderId) : null;
  if (!renderRecord) return null;
  return {
    layoutPreset: cloneRenderLayoutPreset(renderRecord.layoutPreset),
    paneDirectionProfiles: cloneRenderPaneDirectionProfiles(renderRecord.paneDirectionProfiles),
    syncFit: cloneRenderSyncFit(renderRecord.syncFit),
  };
}

function restoreRenderPopoutLocalUiState(localUiState) {
  if (!isRenderPopoutWindow() || !localUiState) return;
  const renderId = getTrackedRenderPopoutId();
  const renderRecord = renderId ? getRenderById(renderId) : null;
  if (!renderRecord) return;
  renderRecord.layoutPreset = cloneRenderLayoutPreset(localUiState.layoutPreset);
  renderRecord.paneDirectionProfiles = cloneRenderPaneDirectionProfiles(localUiState.paneDirectionProfiles);
  renderRecord.syncFit = cloneRenderSyncFit(localUiState.syncFit);
  state.activeWorkspaceTab = { kind: "render", renderId };
  state.activeRenderId = null;
  syncRenderWorkspaceStateFromRecord(renderRecord);
}

function applyRenderPopoutMirrorPayload(payload) {
  if (!isRenderPopoutWindow()) return false;
  const localUiState = captureRenderPopoutLocalUiState();
  let normalizedProject;
  try {
    normalizedProject = normalizeImportedProjectFile(payload);
  } catch {
    return false;
  }
  applyImportedProject(normalizedProject, state.projectFileName);
  const renderId = getTrackedRenderPopoutId();
  const renderRecord = renderId ? getRenderById(renderId) : null;
  if (!renderRecord) {
    state.activeWorkspaceTab = { kind: "main" };
    state.activeRenderId = null;
    renderWorkspaceUi();
    return false;
  }
  restoreRenderPopoutLocalUiState(localUiState);
  renderWorkspaceUi();
  render();
  return true;
}

function startRenderPopoutCloseMonitor() {
  if (!isRenderPopoutMainController()) return;
  if (renderPopoutSession.monitorId) window.clearInterval(renderPopoutSession.monitorId);
  renderPopoutSession.monitorId = window.setInterval(() => {
    const trackedWindow = renderPopoutSession.windowRef;
    if (!trackedWindow) return;
    if (trackedWindow.closed) {
      clearTrackedRenderPopout(false);
    }
  }, 500);
}

function stopRenderPopoutCloseMonitor() {
  if (!renderPopoutSession.monitorId) return;
  window.clearInterval(renderPopoutSession.monitorId);
  renderPopoutSession.monitorId = null;
}

function clearTrackedRenderPopout(shouldRender = true) {
  stopRenderPopoutCloseMonitor();
  closeRenderPopoutChannel();
  clearPersistedRenderPopoutMirrorPayload();
  renderPopoutSession.windowRef = null;
  renderPopoutSession.openRenderId = null;
  renderPopoutSession.token = null;
  renderPopoutSession.snapshotKey = null;
  renderPopoutSession.channelName = null;
  if (shouldRender) {
    renderWorkspaceUi();
    render();
  }
}

function closeTrackedRenderPopout() {
  if (!isRenderPopoutMainController() || !renderPopoutSession.openRenderId) return false;
  const channel = ensureRenderPopoutChannel();
  if (channel) {
    channel.postMessage({ type: "close-window" });
  }
  try {
    renderPopoutSession.windowRef?.close();
  } catch {}
  clearTrackedRenderPopout(true);
  return true;
}

function openTrackedRenderPopout(renderId) {
  if (!isRenderPopoutMainController()) return false;
  const targetRender = getRenderById(renderId);
  if (!targetRender) return false;
  if (renderPopoutSession.openRenderId) {
    closeTrackedRenderPopout();
  }

  const token = generateRenderPopoutToken();
  renderPopoutSession.token = token;
  renderPopoutSession.snapshotKey = getRenderPopoutSnapshotStorageKey(token);
  renderPopoutSession.channelName = getRenderPopoutChannelName(token);
  renderPopoutSession.openRenderId = renderId;
  closeRenderPopoutChannel();

  const snapshotPayload = captureRenderPopoutMirrorPayload(renderId);
  persistRenderPopoutMirrorPayload(snapshotPayload);

  const url = new URL(window.location.href);
  url.searchParams.set(RENDER_POPOUT_QUERY_PARAM, "1");
  url.searchParams.set(RENDER_POPOUT_RENDER_ID_QUERY_PARAM, renderId);
  url.searchParams.set(RENDER_POPOUT_TOKEN_QUERY_PARAM, token);

  const nextWindow = window.open(
    url.toString(),
    RENDER_POPOUT_WINDOW_NAME,
    "popup=yes,width=1440,height=960,resizable=yes,scrollbars=no"
  );
  if (!nextWindow) {
    clearTrackedRenderPopout(false);
    renderWorkspaceUi();
    render();
    return false;
  }

  renderPopoutSession.windowRef = nextWindow;
  ensureRenderPopoutChannel();
  startRenderPopoutCloseMonitor();
  renderWorkspaceUi();
  render();
  return true;
}

function syncTrackedRenderPopout(reason = "commit") {
  if (!isRenderPopoutMainController() || !renderPopoutSession.openRenderId) return false;
  const targetRender = getRenderById(renderPopoutSession.openRenderId);
  if (!targetRender) {
    closeTrackedRenderPopout();
    return false;
  }
  const payload = captureRenderPopoutMirrorPayload(renderPopoutSession.openRenderId);
  persistRenderPopoutMirrorPayload(payload);
  const channel = ensureRenderPopoutChannel();
  if (channel) {
    channel.postMessage({
      type: "mirror-state",
      reason,
      payload,
    });
  }
  return true;
}

function getRenderPopoutSnapshotStorageKey(token) {
  return `${RENDER_POPOUT_MIRROR_STORAGE_PREFIX}${String(token || "").trim()}`;
}

function getRenderPopoutChannelName(token) {
  return `${RENDER_POPOUT_CHANNEL_PREFIX}${String(token || "").trim()}`;
}

function parseRenderPopoutRuntime() {
  try {
    const url = new URL(window.location.href);
    const enabled = url.searchParams.get(RENDER_POPOUT_QUERY_PARAM) === "1";
    const renderId = String(url.searchParams.get(RENDER_POPOUT_RENDER_ID_QUERY_PARAM) || "").trim();
    const token = String(url.searchParams.get(RENDER_POPOUT_TOKEN_QUERY_PARAM) || "").trim();
    if (!enabled || !renderId || !token) {
      return {
        enabled: false,
        renderId: null,
        token: null,
        snapshotKey: null,
        channelName: null,
      };
    }
    return {
      enabled: true,
      renderId,
      token,
      snapshotKey: getRenderPopoutSnapshotStorageKey(token),
      channelName: getRenderPopoutChannelName(token),
    };
  } catch {
    return {
      enabled: false,
      renderId: null,
      token: null,
      snapshotKey: null,
      channelName: null,
    };
  }
}

const renderPopoutRuntime = parseRenderPopoutRuntime();
const renderPopoutSession = {
  mode: renderPopoutRuntime.enabled ? "popout" : "main",
  targetRenderId: renderPopoutRuntime.renderId,
  token: renderPopoutRuntime.token,
  snapshotKey: renderPopoutRuntime.snapshotKey,
  channelName: renderPopoutRuntime.channelName,
  channel: null,
  windowRef: null,
  monitorId: null,
  openRenderId: null,
};

if (renderPopoutRuntime.enabled) {
  document.body.classList.add("render-popout-window");
}

const selectionStrokeColor = "#0ea5e9";
const previewStrokeColor = "#0284c7";
const renderBoxStrokeColor = "#f97316";
const renderBoxStrokeColorSoft = "rgba(249, 115, 22, 0.96)";
const renderBoxLabelFont = "600 11px IBM Plex Sans, Segoe UI, sans-serif";
const renderBoxSideLabelFont = "600 10px IBM Plex Sans, Segoe UI, sans-serif";
const previewStrokeWidth = 1.5;
const vertexMarkerRadiusPx = 2.5;
const activeLayerOutlineWidthFactor = 1.64;
const activeLayerVertexRadiusFactor = 1.28;
const minZoom = 0.02;
const maxZoom = 50;
const ellipseSegments = 96;
const squareBrushAxisDecisionDistancePx = 12;
const squareBrushAxisDecisionBiasPx = 5;
const gridMinorStrokeColor = "rgba(8, 12, 16, 0.12)";
const gridMidStrokeColor = "rgba(8, 12, 16, 0.2)";
const gridMajorStrokeColor = "rgba(8, 12, 16, 0.3)";
const worldAxisStrokeColor = "rgba(180, 99, 78, 0.92)";
const worldAxisStrokeColorDrawMode = "rgba(180, 99, 78, 0.48)";
const inactiveLayerDrawModeOpacityFactor = 0.38;
const draftAlignActiveAxisSnapThresholdPx = 15;
const draftAlignActiveAxisSnapMinDragPx = 12;
const gridAdaptiveStepFactors = Object.freeze([2, 2.5, 2]);
const visibleGridMidInterval = 5;
const visibleGridMajorInterval = 10;
const minVisibleGridStepPx = 18;
const rulerMinorLabelMinPx = 84;
const rulerMidLabelMinPx = 120;
const rulerLabelPaddingPx = 12;
const adaptiveMinimumCellSizeMm = 1;
const minDrawableDraftExtent = 1e-6;
const gridFadeMinPx = 4;
const gridFadeMaxPx = 14;
const maxGridLinesPerAxis = 2000;
const snapPreviewSize = 8;
const rulerPreviewIndicatorThicknessPx = 5;
const rulerPreviewIndicatorMinLengthPx = 0;
const rulerPreviewIndicatorInsetPx = 1;
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
let draftAngleStore = createDraftAngleStore({
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

function sanitizeSettingsToggle(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "on" || value === "true" || value === 1 || value === "1") return true;
  if (value === "off" || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function sanitizeColorValue(value, fallback = DEFAULT_SETTINGS.outlineColor) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function sanitizeAlignSnapValue(value, fallback = DEFAULT_SETTINGS.alignSnap) {
  if (value === "off" || value === null || value === false) return "off";
  const numericValue = Number(value);
  return numericValue === 15 || numericValue === 30 || numericValue === 45 || numericValue === 90 ? numericValue : fallback;
}

function sanitizeRenderDepthMode(mode, fallback = DEFAULT_RENDER_DEPTH_EFFECT.mode) {
  return mode === "shadow" || mode === "fog" || mode === "off" ? mode : fallback;
}

function sanitizeRenderDepthStrength(value, fallback = DEFAULT_RENDER_DEPTH_EFFECT.strength) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numericValue * 100) / 100));
}

function sanitizeRenderOutlineThickness(value, fallback = DEFAULT_RENDER_OUTLINE_EFFECT.thickness) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(1, Math.min(12, Math.round(numericValue)));
}

function cloneRenderDepthEffect(effect = null) {
  const fallbackMode = effect?.enabled === false ? "off" : DEFAULT_RENDER_DEPTH_EFFECT.mode;
  const mode = sanitizeRenderDepthMode(effect?.mode, fallbackMode);
  return {
    enabled: mode !== "off",
    mode,
    strength: sanitizeRenderDepthStrength(effect?.strength, DEFAULT_RENDER_DEPTH_EFFECT.strength),
  };
}

function cloneRenderOutlineEffect(effect = null) {
  return {
    enabled: sanitizeSettingsToggle(effect?.enabled, DEFAULT_RENDER_OUTLINE_EFFECT.enabled),
    thickness: sanitizeRenderOutlineThickness(effect?.thickness, DEFAULT_RENDER_OUTLINE_EFFECT.thickness),
    color: sanitizeColorValue(effect?.color, DEFAULT_RENDER_OUTLINE_EFFECT.color),
  };
}

function cloneRenderSettings(settings = state.renderSettings) {
  return {
    depthEffect: cloneRenderDepthEffect(settings?.depthEffect),
    outlineEffect: cloneRenderOutlineEffect(settings?.outlineEffect),
  };
}

function formatRenderDepthStrength(value) {
  const normalized = sanitizeRenderDepthStrength(value, DEFAULT_RENDER_DEPTH_EFFECT.strength);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2).replace(/\.?0+$/, "");
}

function cloneSettings(settings = state.settings) {
  return {
    displayUnit: sanitizeMeasurementUnit(settings?.displayUnit, DEFAULT_SETTINGS.displayUnit),
    cellUnit: sanitizeMeasurementUnit(settings?.cellUnit, DEFAULT_SETTINGS.cellUnit),
    cellSize: sanitizeCellSize(settings?.cellSize, DEFAULT_SETTINGS.cellSize),
    snapMode: sanitizeGridSnapMode(settings?.snapMode, DEFAULT_SETTINGS.snapMode),
    alignSnap: sanitizeAlignSnapValue(settings?.alignSnap, DEFAULT_SETTINGS.alignSnap),
    outlineEnabled: sanitizeSettingsToggle(settings?.outlineEnabled, DEFAULT_SETTINGS.outlineEnabled),
    outlineColor: sanitizeColorValue(settings?.outlineColor, DEFAULT_SETTINGS.outlineColor),
    cornersEnabled: sanitizeSettingsToggle(settings?.cornersEnabled, DEFAULT_SETTINGS.cornersEnabled),
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

function formatLengthInputValue(valueMm, unitId = state.settings.displayUnit) {
  const fractionDigits = getMeasurementUnit(unitId).fractionDigits;
  return formatLengthValue(valueMm, unitId, fractionDigits);
}

function getLengthInputStep(unitId = state.settings.displayUnit) {
  const fractionDigits = getMeasurementUnit(unitId).fractionDigits;
  if (fractionDigits <= 0) return "1";
  return (1 / 10 ** fractionDigits).toString();
}

function parseNumericInputString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") return null;
  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseLayerSettingsLengthInput(value, unitId = state.settings.displayUnit) {
  const numericValue = parseNumericInputString(value);
  if (numericValue === null) return null;
  return quantizeCoordinate(convertLengthToMm(numericValue, unitId));
}

function getAreaFractionDigits(unitId = state.settings.displayUnit) {
  if (unitId === "m") return 6;
  if (unitId === "cm") return 3;
  return 1;
}

function formatAreaValue(valueMm2, unitId = state.settings.displayUnit, maxFractionDigits = null) {
  const unit = getMeasurementUnit(unitId);
  const displayValue = Number(valueMm2) / unit.toMm ** 2;
  const resolvedFractionDigits = maxFractionDigits ?? getAreaFractionDigits(unitId);
  const rounded = Math.abs(displayValue) <= 10 ** -(resolvedFractionDigits + 1) ? 0 : displayValue;
  return rounded.toFixed(resolvedFractionDigits).replace(/\.?0+$/, "");
}

function formatAreaWithUnit(valueMm2, unitId = state.settings.displayUnit, maxFractionDigits = null) {
  return `${formatAreaValue(valueMm2, unitId, maxFractionDigits)} ${getMeasurementUnit(unitId).shortLabel}²`;
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

function getActiveDraftAngleFamilyContext() {
  const snapshot = draftAngleStore.getSnapshot();
  const activeState = snapshot?.activeState || null;
  if (activeState?.mode !== "family" || !activeState.familyId) return null;

  const familyRecord = Array.isArray(snapshot?.familyRecords)
    ? snapshot.familyRecords.find((record) => record.id === activeState.familyId) || null
    : null;
  if (!familyRecord) return null;

  return {
    activeState,
    activeRotation: snapshot?.activeRotation || getActiveDraftAngleRotation(),
    familyRecord,
  };
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

  for (const button of settingsAlignSnapButtons) {
    const buttonValue = button.dataset.settingsAlignSnap === "off" ? "off" : Number(button.dataset.settingsAlignSnap);
    const active = buttonValue === state.settingsDraft.alignSnap;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  for (const button of settingsOutlineButtons) {
    const active = button.dataset.settingsOutlineEnabled === (state.settingsDraft.outlineEnabled ? "on" : "off");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  const cornersControlsEnabled = !!state.settingsDraft.outlineEnabled;
  const effectiveCornersEnabled = cornersControlsEnabled && !!state.settingsDraft.cornersEnabled;
  for (const button of settingsCornersButtons) {
    const active = button.dataset.settingsCornersEnabled === (effectiveCornersEnabled ? "on" : "off");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = !cornersControlsEnabled;
  }

  if (settingsCellSizeInput) {
    settingsCellSizeInput.value = adaptiveModeActive ? "1" : String(state.settingsDraft.cellSize);
    settingsCellSizeInput.disabled = adaptiveModeActive;
  }

  if (settingsOutlineColorInput) {
    settingsOutlineColorInput.value = sanitizeColorValue(state.settingsDraft.outlineColor, DEFAULT_SETTINGS.outlineColor);
  }

  if (settingsOutlineSwatch) {
    settingsOutlineSwatch.style.setProperty("--settings-swatch-color", sanitizeColorValue(state.settingsDraft.outlineColor, DEFAULT_SETTINGS.outlineColor));
  }
}

function isRenderSettingsMenuOpen() {
  return !!renderSettingsModal && !renderSettingsModal.classList.contains("hidden");
}

function isRenderBoxPropertiesModalOpen() {
  return !!renderBoxPropertiesModal && !renderBoxPropertiesModal.classList.contains("hidden");
}

function syncRenderSettingsMenu() {
  if (!state.renderSettingsDraft || !renderSettingsModal) return;

  for (const button of renderDepthModeButtons) {
    const active = button.dataset.renderDepthMode === state.renderSettingsDraft.depthEffect.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  const depthControlsEnabled = state.renderSettingsDraft.depthEffect.enabled;
  if (renderDepthStrengthDecrease) renderDepthStrengthDecrease.disabled = !depthControlsEnabled;
  if (renderDepthStrengthIncrease) renderDepthStrengthIncrease.disabled = !depthControlsEnabled;
  if (renderDepthStrengthValue) {
    renderDepthStrengthValue.disabled = !depthControlsEnabled;
    renderDepthStrengthValue.value = formatRenderDepthStrength(state.renderSettingsDraft.depthEffect.strength);
  }

  for (const button of renderOutlineButtons) {
    const active = button.dataset.renderOutline === (state.renderSettingsDraft.outlineEffect.enabled ? "on" : "off");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  if (renderOutlineColorInput) {
    renderOutlineColorInput.value = sanitizeColorValue(
      state.renderSettingsDraft.outlineEffect.color,
      DEFAULT_RENDER_OUTLINE_EFFECT.color
    );
    renderOutlineColorInput.disabled = !state.renderSettingsDraft.outlineEffect.enabled;
  }

  if (renderOutlineWidthInput) {
    renderOutlineWidthInput.value = String(
      sanitizeRenderOutlineThickness(
        state.renderSettingsDraft.outlineEffect.thickness,
        DEFAULT_RENDER_OUTLINE_EFFECT.thickness
      )
    );
    renderOutlineWidthInput.disabled = !state.renderSettingsDraft.outlineEffect.enabled;
  }
}

function createRenderBoxPropertiesDraft(renderId) {
  const renderRecord = getRenderById(renderId);
  if (!renderRecord) return null;
  const volume = cloneRenderVolumeSettings(renderRecord.volume);
  return {
    renderId: renderRecord.id,
    name: getRenderTabLabel(renderRecord),
    baseElevationMm: volume.baseElevationMm,
    heightMm: volume.heightMm,
  };
}

function getRenderBoxPropertiesEndMm(draft = state.renderBoxPropertiesDraft) {
  if (!draft) return 0;
  return quantizeCoordinate(draft.baseElevationMm + draft.heightMm);
}

function syncRenderBoxPropertiesModal() {
  if (!state.renderBoxPropertiesDraft || !renderBoxPropertiesModal) return;

  const displayUnitId = state.settings.displayUnit;
  const lengthStep = getLengthInputStep(displayUnitId);

  if (renderBoxPropertiesTarget) {
    renderBoxPropertiesTarget.textContent = state.renderBoxPropertiesDraft.name;
  }

  if (renderBoxPropertiesHeightInput) {
    renderBoxPropertiesHeightInput.step = lengthStep;
    renderBoxPropertiesHeightInput.value = formatLengthInputValue(state.renderBoxPropertiesDraft.heightMm, displayUnitId);
  }

  if (renderBoxPropertiesStartInput) {
    renderBoxPropertiesStartInput.step = lengthStep;
    renderBoxPropertiesStartInput.value = formatLengthInputValue(state.renderBoxPropertiesDraft.baseElevationMm, displayUnitId);
  }

  if (renderBoxPropertiesEndInput) {
    renderBoxPropertiesEndInput.step = lengthStep;
    renderBoxPropertiesEndInput.value = formatLengthInputValue(getRenderBoxPropertiesEndMm(), displayUnitId);
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeLayerSettingsScrollTop(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return numericValue;
}

function cloneLayerSettingsUiMemory(memory = DEFAULT_LAYER_SETTINGS_UI_MEMORY, drawingIds = null) {
  const validDrawingIds = new Set(
    Array.isArray(drawingIds) ? drawingIds : Array.isArray(state.drawingsUi) ? state.drawingsUi.map((drawing) => drawing.id) : []
  );
  const collapsedByDrawingId = {};
  if (isPlainObject(memory?.collapsedByDrawingId)) {
    for (const [drawingId, collapsed] of Object.entries(memory.collapsedByDrawingId)) {
      if (validDrawingIds.size && !validDrawingIds.has(drawingId)) continue;
      collapsedByDrawingId[drawingId] = collapsed === true;
    }
  }
  return {
    collapsedByDrawingId,
    scrollTop: sanitizeLayerSettingsScrollTop(memory?.scrollTop),
  };
}

function normalizeImportedLayerSettingsUiMemory(memory, drawingIds) {
  if (!isPlainObject(memory)) {
    return cloneLayerSettingsUiMemory(DEFAULT_LAYER_SETTINGS_UI_MEMORY, drawingIds);
  }
  return cloneLayerSettingsUiMemory(memory, drawingIds);
}

function createProjectImportError(message) {
  const error = new Error(message);
  error.name = "ProjectImportError";
  return error;
}

function sanitizeProjectFileName(name, fallback = DEFAULT_PROJECT_FILE_NAME) {
  if (typeof name !== "string") return fallback;
  const trimmed = name.trim();
  return trimmed ? trimmed : fallback;
}

function sanitizeProjectCounter(value, fallback = 1) {
  const numericValue = Math.trunc(Number(value));
  if (!Number.isFinite(numericValue) || numericValue < 1) return fallback;
  return numericValue;
}

function sanitizeProjectTool(tool, fallback = state.tool) {
  return tool === "select" || tool === "draw" ? tool : fallback;
}

function sanitizeProjectShapeType(shapeType, fallback = state.shapeType) {
  return shapeType === "rect" || shapeType === "rbox" || shapeType === "ellipse" || shapeType === "strip" || shapeType === "square-brush"
    ? shapeType
    : fallback;
}

function sanitizeProjectSizeControl(value, fallback = 1) {
  const numericValue = Math.round(Number(value));
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(1, Math.min(50, numericValue));
}

function sanitizeProjectBounds(bounds, fallback = { x: 0, y: 0, w: 0, h: 0 }, quantize = false) {
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const w = Number(bounds?.w);
  const h = Number(bounds?.h);
  const sanitizedBounds = {
    x: Number.isFinite(x) ? x : fallback.x,
    y: Number.isFinite(y) ? y : fallback.y,
    w: Math.max(0, Number.isFinite(w) ? w : fallback.w),
    h: Math.max(0, Number.isFinite(h) ? h : fallback.h),
  };

  if (!quantize) return sanitizedBounds;

  return {
    x: quantizeCoordinate(sanitizedBounds.x),
    y: quantizeCoordinate(sanitizedBounds.y),
    w: quantizeCoordinate(sanitizedBounds.w),
    h: quantizeCoordinate(sanitizedBounds.h),
  };
}

function sanitizeProjectPoint(value, fallback = { x: 0, y: 0 }, quantize = false) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const point = {
    x: Number.isFinite(x) ? x : fallback.x,
    y: Number.isFinite(y) ? y : fallback.y,
  };
  return quantize ? quantizePoint(point) : point;
}

function sanitizeProjectCamera(camera, fallback = state.camera) {
  return {
    x: Number.isFinite(Number(camera?.x)) ? Number(camera.x) : fallback.x,
    y: Number.isFinite(Number(camera?.y)) ? Number(camera.y) : fallback.y,
    zoom: Math.max(minZoom, Math.min(maxZoom, Number.isFinite(Number(camera?.zoom)) ? Number(camera.zoom) : fallback.zoom)),
  };
}

function cloneProjectDraftAngleSnapshot(snapshot = draftAngleStore.getSnapshot()) {
  return {
    nextFamilyId: sanitizeProjectCounter(snapshot?.nextFamilyId, 1),
    familyRecords: Array.isArray(snapshot?.familyRecords) ? snapshot.familyRecords.map((record) => ({ ...record })) : [],
    candidateRecord: snapshot?.candidateRecord ? { ...snapshot.candidateRecord } : null,
    activeState: snapshot?.activeState ? { ...snapshot.activeState } : null,
  };
}

function sanitizeLayerRenderRole(value, fallback = DEFAULT_LAYER_RENDER.role) {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function cloneLayerRenderSettings(render = null) {
  return {
    enabled: render?.enabled !== false,
    baseElevationMm: Number.isFinite(Number(render?.baseElevationMm)) ? quantizeCoordinate(Number(render.baseElevationMm)) : DEFAULT_LAYER_RENDER.baseElevationMm,
    heightMm: Math.max(
      0,
      Number.isFinite(Number(render?.heightMm)) ? quantizeCoordinate(Number(render.heightMm)) : DEFAULT_LAYER_RENDER.heightMm
    ),
    role: sanitizeLayerRenderRole(render?.role, DEFAULT_LAYER_RENDER.role),
  };
}

function cloneRenderSectionEntries(entries) {
  return Array.isArray(entries) ? entries.filter(isPlainObject).map((entry) => ({ ...entry })) : [];
}

function cloneRenderSectionSettings(sectionSettings = null) {
  return {
    z: cloneRenderSectionEntries(sectionSettings?.z),
    x: cloneRenderSectionEntries(sectionSettings?.x),
    y: cloneRenderSectionEntries(sectionSettings?.y),
  };
}

function cloneRenderVolumeSettings(volume = null) {
  return {
    baseElevationMm: Number.isFinite(Number(volume?.baseElevationMm))
      ? quantizeCoordinate(Number(volume.baseElevationMm))
      : DEFAULT_RENDER_VOLUME.baseElevationMm,
    heightMm: Math.max(
      0,
      Number.isFinite(Number(volume?.heightMm))
        ? quantizeCoordinate(Number(volume.heightMm))
        : DEFAULT_RENDER_VOLUME.heightMm
    ),
  };
}

function normalizeRenderPaneDirection(direction, fallback = DEFAULT_RENDER_PANE_DIRECTIONS[0]) {
  return STANDARD_RENDER_DIRECTIONS.includes(direction) ? direction : fallback;
}

function normalizeRenderPaneDirections(directions = null) {
  return DEFAULT_RENDER_PANE_DIRECTIONS.map((fallbackDirection, slotIndex) =>
    normalizeRenderPaneDirection(Array.isArray(directions) ? directions[slotIndex] : null, fallbackDirection)
  );
}

function sanitizeRenderLayoutPreset(value, fallback = 1) {
  const numericValue = Number(value);
  return STANDARD_RENDER_LAYOUT_PRESETS.includes(numericValue) ? numericValue : fallback;
}

function cloneRenderPaneDirectionProfiles(profiles = null, fallbackDirections = null) {
  const fallbackProfile = normalizeRenderPaneDirections(fallbackDirections);
  const source = isPlainObject(profiles) ? profiles : null;
  return {
    1: normalizeRenderPaneDirections(source?.[1] ?? source?.["1"] ?? fallbackProfile),
    2: normalizeRenderPaneDirections(source?.[2] ?? source?.["2"] ?? fallbackProfile),
    4: normalizeRenderPaneDirections(source?.[4] ?? source?.["4"] ?? fallbackProfile),
  };
}

function cloneRenderSyncFit(value = null) {
  return sanitizeSettingsToggle(value, DEFAULT_RENDER_SYNC_FIT);
}

function cloneRenderLayoutPreset(value = null) {
  return sanitizeRenderLayoutPreset(value, 1);
}

function getRenderDirectionLabel(direction) {
  switch (direction) {
    case "bottomToTop":
      return "Bottom to Top";
    case "leftToRight":
      return "Left to Right";
    case "rightToLeft":
      return "Right to Left";
    case "plan":
      return "Plan";
    case "topToBottom":
    default:
      return "Top to Bottom";
  }
}

function getRenderDirectionShortLabel(direction) {
  switch (direction) {
    case "bottomToTop":
      return "B-T";
    case "leftToRight":
      return "L-R";
    case "rightToLeft":
      return "R-L";
    case "plan":
      return "PL";
    case "topToBottom":
    default:
      return "T-B";
  }
}

function getRenderDirectionConfig(direction) {
  switch (direction) {
    case "bottomToTop":
      return {
        label: getRenderDirectionLabel(direction),
        shortLabel: getRenderDirectionShortLabel(direction),
        mode: "directional",
        primaryAxis: "localX",
        depthAxis: "localY",
        verticalAxis: "elevation",
        frontBoundary: "max",
        mirrorPrimary: false,
      };
    case "leftToRight":
      return {
        label: getRenderDirectionLabel(direction),
        shortLabel: getRenderDirectionShortLabel(direction),
        mode: "directional",
        primaryAxis: "localY",
        depthAxis: "localX",
        verticalAxis: "elevation",
        frontBoundary: "min",
        mirrorPrimary: false,
      };
    case "rightToLeft":
      return {
        label: getRenderDirectionLabel(direction),
        shortLabel: getRenderDirectionShortLabel(direction),
        mode: "directional",
        primaryAxis: "localY",
        depthAxis: "localX",
        verticalAxis: "elevation",
        frontBoundary: "max",
        mirrorPrimary: true,
      };
    case "plan":
      return {
        label: getRenderDirectionLabel(direction),
        shortLabel: getRenderDirectionShortLabel(direction),
        mode: "plan",
        primaryAxis: "localX",
        depthAxis: "elevation",
        verticalAxis: "localY",
        frontBoundary: "max",
        mirrorPrimary: false,
      };
    case "topToBottom":
    default:
      return {
        label: getRenderDirectionLabel(direction),
        shortLabel: getRenderDirectionShortLabel(direction),
        mode: "directional",
        primaryAxis: "localX",
        depthAxis: "localY",
        verticalAxis: "elevation",
        frontBoundary: "min",
        mirrorPrimary: true,
      };
  }
}

function cloneActiveWorkspaceTab(workspaceTab = DEFAULT_ACTIVE_WORKSPACE_TAB, renderIds = null) {
  if (
    isPlainObject(workspaceTab) &&
    workspaceTab.kind === "render" &&
    typeof workspaceTab.renderId === "string" &&
    (!renderIds || renderIds.has(workspaceTab.renderId))
  ) {
    return { kind: "render", renderId: workspaceTab.renderId };
  }
  return { kind: "main" };
}

function sanitizeRenderBoxGeometry(boxGeometry = null) {
  if (!Array.isArray(boxGeometry)) return [];

  const nextPoints = [];
  for (const point of boxGeometry) {
    if (!isPlainObject(point)) return [];
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    nextPoints.push(quantizePoint({ x, y }));
  }

  return nextPoints.length === 4 ? nextPoints : [];
}

function cloneRenderBoxGeometry(boxGeometry = null) {
  return sanitizeRenderBoxGeometry(boxGeometry).map((point) => ({ ...point }));
}

function getRenderBoxMetrics(render) {
  const boxGeometry = sanitizeRenderBoxGeometry(render?.boxGeometry);
  if (boxGeometry.length !== 4) {
    return {
      boxGeometry: [],
      width: 0,
      height: 0,
      anchor: null,
      center: null,
      isValid: false,
    };
  }

  const width = quantizeCoordinate(distanceBetweenPoints(boxGeometry[0], boxGeometry[1]));
  const height = quantizeCoordinate(distanceBetweenPoints(boxGeometry[1], boxGeometry[2]));
  const anchor = { ...boxGeometry[0] };
  const center = quantizePoint({
    x: boxGeometry.reduce((sum, point) => sum + point.x, 0) / boxGeometry.length,
    y: boxGeometry.reduce((sum, point) => sum + point.y, 0) / boxGeometry.length,
  });

  return {
    boxGeometry,
    width,
    height,
    anchor,
    center,
    isValid: width > 1e-6 && height > 1e-6,
  };
}

function getRenderBoxLocalFrame(render) {
  const metrics = getRenderBoxMetrics(render);
  if (!metrics.isValid || metrics.boxGeometry.length !== 4) return null;

  const [origin, xTarget, , yTarget] = metrics.boxGeometry;
  const width = distanceBetweenPoints(origin, xTarget);
  const height = distanceBetweenPoints(origin, yTarget);
  if (width <= 1e-6 || height <= 1e-6) return null;

  return {
    origin: { ...origin },
    xAxis: quantizePoint({
      x: (xTarget.x - origin.x) / width,
      y: (xTarget.y - origin.y) / width,
    }),
    yAxis: quantizePoint({
      x: (yTarget.x - origin.x) / height,
      y: (yTarget.y - origin.y) / height,
    }),
    widthMm: quantizeCoordinate(width),
    heightMm: quantizeCoordinate(height),
    boxGeometry: metrics.boxGeometry.map((point) => ({ ...point })),
    boundsWorld: getGeometryBounds([[metrics.boxGeometry.map((point) => [point.x, point.y])]]),
  };
}

function worldPointToRenderLocal(point, frame) {
  const dx = point.x - frame.origin.x;
  const dy = point.y - frame.origin.y;
  return quantizePoint({
    x: dx * frame.xAxis.x + dy * frame.xAxis.y,
    y: dx * frame.yAxis.x + dy * frame.yAxis.y,
  });
}

function getRenderBoxGeometryFromDraftRect(startDraft, currentDraft) {
  const rect = getSelectionBoxRect(startDraft, currentDraft);
  if (!rect || rect.w <= 1e-6 || rect.h <= 1e-6) return [];
  return getSelectionBoxCorners(rect).map((point) => draftToWorld(point));
}

function cloneRenderRecord(render) {
  return {
    id: render.id,
    name: render.name,
    visible: render.visible !== false,
    layoutPreset: cloneRenderLayoutPreset(render.layoutPreset),
    paneDirectionProfiles: cloneRenderPaneDirectionProfiles(render.paneDirectionProfiles),
    syncFit: cloneRenderSyncFit(render.syncFit),
    boxGeometry: cloneRenderBoxGeometry(render.boxGeometry),
    volume: cloneRenderVolumeSettings(render.volume),
    sectionSettings: cloneRenderSectionSettings(render.sectionSettings),
  };
}

function getRenderTabLabel(render, index = state.renders.findIndex((entry) => entry.id === render?.id)) {
  const fallbackIndex = index >= 0 ? index + 1 : 1;
  const trimmedName = typeof render?.name === "string" ? render.name.trim() : "";
  return trimmedName || `Rbox ${fallbackIndex}`;
}

function getRenderBoxSummary(render) {
  const metrics = getRenderBoxMetrics(render);
  if (!metrics.isValid) return "No Render Box Yet";
  return `Box ${formatLengthWithUnit(metrics.width)} × ${formatLengthWithUnit(metrics.height)}`;
}

function getRenderSectionSummary(render) {
  const sections = cloneRenderSectionSettings(render?.sectionSettings);
  return `Sections Z ${sections.z.length} | X ${sections.x.length} | Y ${sections.y.length}`;
}

function getRenderVolumeStartMm(render) {
  return cloneRenderVolumeSettings(render?.volume).baseElevationMm;
}

function getRenderVolumeHeightMm(render) {
  return cloneRenderVolumeSettings(render?.volume).heightMm;
}

function getRenderVolumeEndMm(render) {
  const volume = cloneRenderVolumeSettings(render?.volume);
  return quantizeCoordinate(volume.baseElevationMm + volume.heightMm);
}

function getRenderVolumeRange(render) {
  const volume = cloneRenderVolumeSettings(render?.volume);
  const startMm = volume.baseElevationMm;
  const endMm = quantizeCoordinate(volume.baseElevationMm + volume.heightMm);
  return {
    baseElevationMm: startMm,
    heightMm: volume.heightMm,
    endMm,
    hasExplicitRange: volume.heightMm > 1e-6,
  };
}

function getActiveRenderRecord() {
  if (state.activeWorkspaceTab?.kind !== "render") return null;
  return state.renders.find((render) => render.id === state.activeWorkspaceTab.renderId) || null;
}

function getSelectedRenderRecord() {
  return getRenderById(state.activeRenderId);
}

function getRenderBoxShape(render) {
  const metrics = getRenderBoxMetrics(render);
  if (!metrics.isValid || metrics.boxGeometry.length !== 4) return null;

  const geometry = [[metrics.boxGeometry.map((point) => [point.x, point.y])]];
  return {
    geometry,
    bounds: getGeometryBounds(geometry),
  };
}

function getRenderTransformHit(render, worldPoint, radius = 8 / state.camera.zoom) {
  if (!render || !worldPoint) return null;
  const shape = getRenderBoxShape(render);
  if (!shape) return null;
  if (!boundsTouch(shape.bounds, { x: worldPoint.x, y: worldPoint.y, w: 0, h: 0 }, radius)) return null;
  if (pointInShapeFill(shape, worldPoint.x, worldPoint.y)) return { type: "move" };
  return distanceToShapeBoundary(shape, worldPoint.x, worldPoint.y) <= radius ? { type: "move" } : null;
}

function moveRenderBoxBy(render, dx, dy) {
  if (!render) return;
  render.boxGeometry = cloneRenderBoxGeometry(render.boxGeometry).map((point) =>
    quantizePoint({
      x: point.x + dx,
      y: point.y + dy,
    })
  );
}

function deactivateActiveRenderBox() {
  state.renderTransformDrag = null;
  state.dragging = false;
  state.activeRenderId = null;
  updateCursor();
  renderLayersPanel();
  render();
}

function activateRenderBox(renderId) {
  const renderRecord = getRenderById(renderId);
  if (!renderRecord) return false;
  if (state.activeRenderId === renderId) {
    deactivateActiveRenderBox();
    return false;
  }

  cancelDrawInteraction();
  cancelSelectionInteraction();
  cancelDraftAlignDrag();
  state.panning = false;
  state.draggingDraftOrigin = false;
  state.draftOriginDragRotation = null;
  clearSelection();
  state.activeWorkspaceTab = { kind: "main" };
  state.activeRenderId = renderId;
  updateCursor();
  renderLayersPanel();
  render();
  return true;
}

function isMainWorkspaceActive() {
  return !getActiveRenderRecord();
}

function describeRenderBounds(render) {
  const metrics = getRenderBoxMetrics(render);
  if (!metrics.isValid || !metrics.anchor || !metrics.center) {
    return "No Render Box Yet";
  }
  return [
    `Box ${formatLengthWithUnit(metrics.width)} × ${formatLengthWithUnit(metrics.height)}`,
    `World anchor ${formatLengthWithUnit(metrics.anchor.x)}, ${formatLengthWithUnit(metrics.anchor.y)}`,
    `Center ${formatLengthWithUnit(metrics.center.x)}, ${formatLengthWithUnit(metrics.center.y)}`,
  ].join("  |  ");
}

function setActiveWorkspaceTab(workspaceTab) {
  const validRenderIds = new Set(state.renders.map((render) => render.id));
  const nextTab = cloneActiveWorkspaceTab(workspaceTab, validRenderIds);
  const currentTab = cloneActiveWorkspaceTab(state.activeWorkspaceTab, validRenderIds);
  const stateNeedsNormalization =
    state.activeWorkspaceTab?.kind !== currentTab.kind || state.activeWorkspaceTab?.renderId !== currentTab.renderId;
  const unchanged = currentTab.kind === nextTab.kind && currentTab.renderId === nextTab.renderId;
  if (unchanged && !stateNeedsNormalization) return false;

  if (state.editingRenderId) {
    const editingRender = getRenderById(state.editingRenderId);
    if (!editingRender || nextTab.kind !== "render" || nextTab.renderId !== state.editingRenderId) {
      const nextName = String(state.editingRenderNameDraft || "").trim();
      if (editingRender) {
        editingRender.name = nextName || state.editingRenderInitialName || editingRender.name;
      }
      state.editingRenderId = null;
      state.editingRenderNameDraft = "";
      state.editingRenderInitialName = "";
    }
  }

  cancelDrawInteraction();
  cancelSelectionInteraction();
  cancelDraftAlignDrag();
  state.panning = false;
  state.draggingDraftOrigin = false;
  state.draftOriginDragRotation = null;
  state.activeWorkspaceTab = nextTab;
  if (nextTab.kind === "render") state.activeRenderId = null;
  state.pointerInCanvas = false;
  updateCursor();
  renderLayersPanel();
  render();
  return true;
}

function getRenderPaneDirection(slotIndex) {
  const preset = sanitizeRenderLayoutPreset(state.renderLayoutPreset, 1);
  const directions = cloneRenderPaneDirectionProfiles(state.renderPaneDirectionProfiles)[preset];
  return normalizeRenderPaneDirection(directions?.[slotIndex], DEFAULT_RENDER_PANE_DIRECTIONS[slotIndex] || DEFAULT_RENDER_PANE_DIRECTIONS[0]);
}

function syncRenderWorkspaceStateFromRecord(renderRecord = getActiveRenderRecord()) {
  if (!renderRecord) return false;

  const nextLayoutPreset = cloneRenderLayoutPreset(renderRecord.layoutPreset);
  const nextPaneDirectionProfiles = cloneRenderPaneDirectionProfiles(renderRecord.paneDirectionProfiles);
  const layoutChanged = state.renderLayoutPreset !== nextLayoutPreset;
  const profilesChanged =
    JSON.stringify(state.renderPaneDirectionProfiles) !== JSON.stringify(nextPaneDirectionProfiles);

  state.renderLayoutPreset = nextLayoutPreset;
  state.renderPaneDirectionProfiles = nextPaneDirectionProfiles;
  renderRecord.layoutPreset = nextLayoutPreset;
  renderRecord.paneDirectionProfiles = cloneRenderPaneDirectionProfiles(nextPaneDirectionProfiles);
  renderRecord.syncFit = cloneRenderSyncFit(renderRecord.syncFit);
  return layoutChanged || profilesChanged;
}

function setRenderPaneDirection(slotIndex, direction) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= DEFAULT_RENDER_PANE_DIRECTIONS.length) return false;
  const activeRender = getActiveRenderRecord();
  if (!activeRender) return false;
  const nextDirection = normalizeRenderPaneDirection(direction, DEFAULT_RENDER_PANE_DIRECTIONS[slotIndex]);
  if (getRenderPaneDirection(slotIndex) === nextDirection) return false;
  const preset = sanitizeRenderLayoutPreset(state.renderLayoutPreset, 1);
  const nextProfiles = cloneRenderPaneDirectionProfiles(state.renderPaneDirectionProfiles);
  nextProfiles[preset][slotIndex] = nextDirection;
  state.renderPaneDirectionProfiles = nextProfiles;
  activeRender.paneDirectionProfiles = cloneRenderPaneDirectionProfiles(nextProfiles);
  renderWorkspaceUi();
  return true;
}

function getLayerMergedGeometryForRender(layerId) {
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layerId);
  if (!layerShapes.length) return [];
  return unionGeometryList(layerShapes.map((shape) => shape.geometry));
}

function getLayerSourceShapesForRender(layerId) {
  return state.shapes.filter((shape) => shape.layerId === layerId).map((shape) => cloneShape(shape));
}

function compileRenderScene() {
  const entries = [];
  const drawingsInUiOrder = state.drawingsUi.slice();
  const drawingOrderIndexById = new Map(drawingsInUiOrder.map((drawing, index) => [drawing.id, index]));

  drawingsInUiOrder
    .slice()
    .reverse()
    .forEach((drawing) => {
      const drawingOrderIndex = drawingOrderIndexById.get(drawing.id) ?? 0;
      const drawingLayers = getLayersForDrawingInStorageOrder(drawing.id);
      const layerCount = drawingLayers.length;

      drawingLayers.forEach((layer, storageOrderIndex) => {
        const layerOrderIndex = Math.max(0, layerCount - 1 - storageOrderIndex);
        const renderSettings = cloneLayerRenderSettings(layer.render);
        if (renderSettings.enabled === false) return;

        const sourceShapesWorld = getLayerSourceShapesForRender(layer.id);
        const geometryWorld = sourceShapesWorld.length ? unionGeometryList(sourceShapesWorld.map((shape) => shape.geometry)) : [];
        if (!geometryWorld.length) return;

        const boundsWorld = getGeometryBounds(geometryWorld);
        const areaWorld = getGeometryArea(geometryWorld);
        const baseElevationMm = quantizeCoordinate(renderSettings.baseElevationMm);
        const heightMm = Math.max(0, quantizeCoordinate(renderSettings.heightMm));
        const topElevationMm = quantizeCoordinate(baseElevationMm + heightMm);

        entries.push({
          drawingId: drawing.id,
          drawingName: drawing.name,
          drawingOrderIndex,
          layerId: layer.id,
          layerName: layer.name,
          layerOrderIndex,
          stackOrderIndex: entries.length,
          fillColor: layer.fillColor,
          geometryWorld,
          sourceShapesWorld,
          boundsWorld,
          areaWorld,
          baseElevationMm,
          heightMm,
          topElevationMm,
          role: renderSettings.role,
        });
      });
    });

  const elevationRange =
    entries.length > 0
      ? {
          minMm: Math.min(...entries.map((entry) => entry.baseElevationMm)),
          maxMm: Math.max(...entries.map((entry) => entry.topElevationMm)),
        }
      : { minMm: 0, maxMm: 0 };

  return {
    entries,
    layerCount: entries.length,
    drawingCount: new Set(entries.map((entry) => entry.drawingId)).size,
    elevationRange,
  };
}

function resolveRenderPaneRequest(renderRecord, slotIndex) {
  const direction = getRenderPaneDirection(slotIndex);
  const directionConfig = getRenderDirectionConfig(direction);
  const frame = getRenderBoxLocalFrame(renderRecord);
  const clipGeometryWorld = frame ? [[frame.boxGeometry.map((point) => [point.x, point.y])]] : [];
  const volumeRange = getRenderVolumeRange(renderRecord);

  return {
    slotIndex,
    renderId: renderRecord?.id || null,
    direction,
    directionConfig,
    frame,
    volumeRange,
    clipGeometryWorld,
    clipBoundsWorld: clipGeometryWorld.length ? getGeometryBounds(clipGeometryWorld) : { x: 0, y: 0, w: 0, h: 0 },
  };
}

function buildRenderPaneFoundation(renderRecord, slotIndex, compiledScene = compileRenderScene()) {
  const request = resolveRenderPaneRequest(renderRecord, slotIndex);
  if (!request.frame || !request.clipGeometryWorld.length) {
    return {
      request,
      compiledScene,
      status: "missing_box",
      intersectingEntries: [],
      intersectingLayerCount: 0,
      clippedAreaWorld: 0,
      elevationRangeMm: { minMm: 0, maxMm: 0 },
    };
  }

  const intersectingEntries = [];
  let clippedAreaWorld = 0;
  const explicitVolumeRange = request.volumeRange?.hasExplicitRange ? request.volumeRange : null;

  compiledScene.entries.forEach((entry) => {
    if (!boundsTouch(entry.boundsWorld, request.clipBoundsWorld)) return;

    const clippedBaseElevationMm = explicitVolumeRange
      ? Math.max(entry.baseElevationMm, explicitVolumeRange.baseElevationMm)
      : entry.baseElevationMm;
    const clippedTopElevationMm = explicitVolumeRange
      ? Math.min(entry.topElevationMm, explicitVolumeRange.endMm)
      : entry.topElevationMm;
    if (clippedTopElevationMm <= clippedBaseElevationMm + 1e-6) return;

    const clippedGeometryWorld = executeClipperBoolean(ClipType.Intersection, entry.geometryWorld, request.clipGeometryWorld);
    if (!clippedGeometryWorld.length) return;

    const localGeometry = transformGeometry(clippedGeometryWorld, (point) => worldPointToRenderLocal(point, request.frame));
    const localBounds = getGeometryBounds(localGeometry);
    const clippedEntryArea = getGeometryArea(clippedGeometryWorld);
    clippedAreaWorld += clippedEntryArea;

    const localSourceComponents = [];
    entry.sourceShapesWorld.forEach((sourceShape) => {
      if (!boundsTouch(sourceShape.bounds, request.clipBoundsWorld)) return;

      const clippedSourceGeometryWorld = executeClipperBoolean(ClipType.Intersection, sourceShape.geometry, request.clipGeometryWorld);
      if (!clippedSourceGeometryWorld.length) return;

      const clippedSourceEligibility = createVertexOutlineEligibilityFromSources(
        clippedSourceGeometryWorld,
        [sourceShape],
        true
      );
      const localSourceGeometry = transformGeometry(clippedSourceGeometryWorld, (point) =>
        worldPointToRenderLocal(point, request.frame)
      );

      localSourceGeometry.forEach((polygon, polygonIndex) => {
        localSourceComponents.push({
          sourceShapeId: sourceShape.id,
          sourceShapeKey: `${entry.layerId}:${sourceShape.id}:${polygonIndex}`,
          localGeometry: [polygon],
          vertexOutlineEligibility: [clippedSourceEligibility[polygonIndex] || []],
        });
      });
    });

    intersectingEntries.push({
      ...entry,
      clippedGeometryWorld,
      localGeometry,
      localSourceComponents,
      localBounds,
      clippedAreaWorld: clippedEntryArea,
      clippedBaseElevationMm: quantizeCoordinate(clippedBaseElevationMm),
      clippedTopElevationMm: quantizeCoordinate(clippedTopElevationMm),
      clippedHeightMm: quantizeCoordinate(clippedTopElevationMm - clippedBaseElevationMm),
    });
  });

  const elevationRangeMm =
    explicitVolumeRange
      ? {
          minMm: explicitVolumeRange.baseElevationMm,
          maxMm: explicitVolumeRange.endMm,
        }
      : intersectingEntries.length > 0
      ? {
          minMm: Math.min(...intersectingEntries.map((entry) => entry.clippedBaseElevationMm)),
          maxMm: Math.max(...intersectingEntries.map((entry) => entry.clippedTopElevationMm)),
        }
      : { minMm: 0, maxMm: 0 };

  return {
    request,
    compiledScene,
    status: intersectingEntries.length ? "ready" : "empty",
    intersectingEntries,
    intersectingLayerCount: intersectingEntries.length,
    clippedAreaWorld,
    elevationRangeMm,
  };
}

function buildRenderPanePlaceholderLines(foundation) {
  const { request, compiledScene } = foundation;
  if (!request.frame) {
    return {
      heading: request.directionConfig.label,
      lines: ["No Render Box Yet", "Commit an Rbox on Main first."],
    };
  }

  if (!foundation.intersectingLayerCount) {
    return {
      heading: request.directionConfig.label,
      lines: [
        "No render-enabled layer geometry intersects this Rbox yet.",
        `Scene ${compiledScene.layerCount} layers | Box ${formatLengthWithUnit(request.frame.widthMm)} × ${formatLengthWithUnit(request.frame.heightMm)}`,
        `Z ${formatLengthWithUnit(foundation.elevationRangeMm.minMm)} → ${formatLengthWithUnit(foundation.elevationRangeMm.maxMm)}`,
      ],
    };
  }

  const primaryMetric =
    request.direction === "plan"
      ? `Plan crop ${formatLengthWithUnit(request.frame.widthMm)} × ${formatLengthWithUnit(request.frame.heightMm)}`
      : `Box ${formatLengthWithUnit(request.frame.widthMm)} × ${formatLengthWithUnit(request.frame.heightMm)}`;

  const layerNames = foundation.intersectingEntries
    .slice(0, 3)
    .map((entry) => entry.layerName)
    .join(", ");
  const remainingCount = Math.max(0, foundation.intersectingEntries.length - 3);
  const layerSummary = remainingCount > 0 ? `${layerNames} + ${remainingCount} more` : layerNames;

  return {
    heading: request.directionConfig.label,
    lines: [
      `${foundation.intersectingLayerCount} render layer${foundation.intersectingLayerCount === 1 ? "" : "s"} intersect this Rbox.`,
      `${primaryMetric} | Z ${formatLengthWithUnit(foundation.elevationRangeMm.minMm)} → ${formatLengthWithUnit(foundation.elevationRangeMm.maxMm)}`,
      layerSummary,
    ],
  };
}

function setRenderPanePlaceholderContent(emptyEl, content) {
  if (!emptyEl) return;
  emptyEl.replaceChildren();

  if (content?.heading) {
    const headingEl = document.createElement("strong");
    headingEl.textContent = content.heading;
    emptyEl.appendChild(headingEl);
  }

  (Array.isArray(content?.lines) ? content.lines : []).forEach((line) => {
    const lineEl = document.createElement("div");
    lineEl.textContent = line;
    emptyEl.appendChild(lineEl);
  });
}

function isRenderPanePainterImplemented(direction) {
  return (
    direction === "topToBottom" ||
    direction === "bottomToTop" ||
    direction === "leftToRight" ||
    direction === "rightToLeft" ||
    direction === "plan"
  );
}

function getVisibleRenderPaneCount(layoutPreset = state.renderLayoutPreset) {
  return layoutPreset === 2 ? 2 : layoutPreset === 4 ? 4 : 1;
}

function getRenderPaneViewportSize(canvasEl) {
  if (!canvasEl || !canvasEl.parentElement) return null;
  const width = canvasEl.parentElement.clientWidth;
  const height = canvasEl.parentElement.clientHeight;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function getRenderPaneCanvasContext(canvasEl) {
  const viewport = getRenderPaneViewportSize(canvasEl);
  if (!viewport) return null;
  const { width, height } = viewport;

  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(width * dpr));
  const targetHeight = Math.max(1, Math.round(height * dpr));
  if (canvasEl.width !== targetWidth || canvasEl.height !== targetHeight) {
    canvasEl.width = targetWidth;
    canvasEl.height = targetHeight;
  }

  const context = canvasEl.getContext("2d");
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawRenderPaneBackdrop(context, width, height) {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.96)";
  context.fillRect(0, 0, width, height);
  context.restore();
}

function hexToRgbChannels(color) {
  const normalized = sanitizeColorValue(color, "#000000");
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbChannelsToHex(r, g, b) {
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function applyRenderDepthShading(color, depthStrengthRatio, renderSettings = state.renderSettings) {
  const depthEffect = cloneRenderDepthEffect(renderSettings?.depthEffect);
  const baseColor = sanitizeColorValue(color, "#93c5fd");
  if (!depthEffect.enabled || depthEffect.mode === "off") return baseColor;
  if (!Number.isFinite(depthStrengthRatio) || depthStrengthRatio <= 0) return baseColor;

  const baseRgb = hexToRgbChannels(baseColor);
  const overlayRgb = depthEffect.mode === "fog" ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const maxAlpha = Math.max(0, Math.min(1, depthEffect.strength / 100));
  const alpha = Math.max(0, Math.min(1, depthStrengthRatio * maxAlpha));
  const mixChannel = (base, overlay) => Math.round(base * (1 - alpha) + overlay * alpha);
  return rgbChannelsToHex(
    mixChannel(baseRgb.r, overlayRgb.r),
    mixChannel(baseRgb.g, overlayRgb.g),
    mixChannel(baseRgb.b, overlayRgb.b)
  );
}

function getDirectionalDepthStrengthRatio(depthMm, nearestVisibleDepthMm, farthestVisibleDepthMm, frontBoundary = "min") {
  if (![depthMm, nearestVisibleDepthMm, farthestVisibleDepthMm].every(Number.isFinite)) return 0;
  const depthRangeMm =
    frontBoundary === "max"
      ? nearestVisibleDepthMm - farthestVisibleDepthMm
      : farthestVisibleDepthMm - nearestVisibleDepthMm;
  if (!(depthRangeMm > 1e-6)) return 0;
  const depthOffsetMm =
    frontBoundary === "max"
      ? nearestVisibleDepthMm - depthMm
      : depthMm - nearestVisibleDepthMm;
  return Math.max(0, Math.min(1, depthOffsetMm / depthRangeMm));
}

function buildRenderPaneDocumentation(foundation) {
  if (!foundation || foundation.status !== "ready") return null;
  switch (foundation.request?.direction) {
    case "plan":
      return buildPlanVectorDocumentation(foundation);
    case "bottomToTop":
    case "leftToRight":
    case "rightToLeft":
    case "topToBottom":
      return buildDirectionalVectorDocumentation(foundation);
    default:
      return null;
  }
}

function isRenderPaneDocumentationPaintable(foundation, documentation) {
  if (!foundation || foundation.status !== "ready" || !documentation) return false;
  switch (foundation.request?.direction) {
    case "plan":
      return Array.isArray(documentation.fillPrimitives) && documentation.fillPrimitives.length > 0;
    case "bottomToTop":
    case "leftToRight":
    case "rightToLeft":
    case "topToBottom":
      return documentation.paintedCellCount > 0;
    default:
      return false;
  }
}

function getRenderPaneAutoFitScale(viewportWidth, viewportHeight, foundation, documentation) {
  if (!foundation || !documentation) return null;
  const availableWidth = viewportWidth - 36;
  const availableHeight = viewportHeight - 36;
  if (!(availableWidth > 0) || !(availableHeight > 0)) return null;

  let contentWidthMm = 0;
  let contentHeightMm = 0;
  switch (foundation.request?.direction) {
    case "plan":
      contentWidthMm = documentation.widthMm;
      contentHeightMm = documentation.heightMm;
      break;
    case "bottomToTop":
    case "leftToRight":
    case "rightToLeft":
    case "topToBottom":
      contentWidthMm = documentation.primarySpanMm;
      contentHeightMm = documentation.zSpanMm;
      break;
    default:
      return null;
  }

  if (!(contentWidthMm > 1e-6) || !(contentHeightMm > 1e-6)) return null;
  const scale = Math.min(availableWidth / contentWidthMm, availableHeight / contentHeightMm);
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

function getDirectionalAxisSpanMm(frame, axisId) {
  if (!frame) return 0;
  return axisId === "localY" ? frame.heightMm : frame.widthMm;
}

function projectDirectionalLocalPoint(point, request, primarySpanMm) {
  const directionConfig = request?.directionConfig;
  const primaryValue = (directionConfig?.primaryAxis === "localY" ? point.y : point.x) || 0;
  const depthValue = (directionConfig?.depthAxis === "localY" ? point.y : point.x) || 0;
  return {
    x: directionConfig?.mirrorPrimary ? primarySpanMm - primaryValue : primaryValue,
    y: depthValue,
  };
}

function getDocumentationCoordinateKey(value) {
  return String(scaleCoordinateToClipperInt(value));
}

function isSameDirectionalDepth(a, b, epsilon = 1e-6) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= epsilon;
}

function projectDirectionalGeometry(geometry, request, primarySpanMm) {
  return transformGeometry(geometry, (point) => projectDirectionalLocalPoint(point, request, primarySpanMm));
}

function collectProjectedGeometryEdges(projectedGeometry) {
  const edges = [];
  forEachRing(projectedGeometry, (ring) => {
    for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 1) {
      const start = ring[pointIndex];
      const end = ring[(pointIndex + 1) % ring.length];
      const minX = Math.min(start[0], end[0]);
      const maxX = Math.max(start[0], end[0]);
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const vertical = Math.abs(dx) <= 1e-9;
      const slope = vertical ? null : dy / dx;
      const intercept = vertical ? null : start[1] - slope * start[0];
      edges.push({
        x1: start[0],
        y1: start[1],
        x2: end[0],
        y2: end[1],
        minX,
        maxX,
        vertical,
        slope,
        intercept,
      });
    }
  });
  return edges;
}

function collectDirectionalDocumentationComponents(foundation) {
  const { request, intersectingEntries } = foundation;
  const primarySpanMm = getDirectionalAxisSpanMm(request?.frame, request?.directionConfig?.primaryAxis);
  const components = [];

  intersectingEntries.forEach((entry) => {
    entry.localSourceComponents.forEach((sourceComponent, sourceIndex) => {
      const projectedGeometry = projectDirectionalGeometry(sourceComponent.localGeometry, request, primarySpanMm);
      if (!projectedGeometry.length) return;

      const projectedBounds = getGeometryBounds(projectedGeometry);

      components.push({
        componentKey: `${entry.layerId}:${sourceComponent.sourceShapeKey}:${sourceIndex}`,
        layerId: entry.layerId,
        sourceShapeKey: sourceComponent.sourceShapeKey,
        fillColor: sanitizeColorValue(entry.fillColor, "#93c5fd"),
        baseElevationMm: entry.clippedBaseElevationMm,
        topElevationMm: entry.clippedTopElevationMm,
        stackOrderIndex: entry.stackOrderIndex,
        projectedGeometry,
        projectedBounds,
        projectedEdges: collectProjectedGeometryEdges(projectedGeometry),
        vertexOutlineEligibility: deepCopyVertexOutlineEligibility(sourceComponent.vertexOutlineEligibility),
      });
    });
  });

  return {
    primarySpanMm,
    components,
  };
}

function computeProjectedEdgeCrossoverPrimary(edgeA, edgeB) {
  if (!edgeA || !edgeB || edgeA.vertical || edgeB.vertical) return null;
  if (Math.abs(edgeA.slope - edgeB.slope) <= 1e-9) return null;

  const overlapMin = Math.max(edgeA.minX, edgeB.minX);
  const overlapMax = Math.min(edgeA.maxX, edgeB.maxX);
  if (overlapMax - overlapMin <= 1e-6) return null;

  const crossX = (edgeB.intercept - edgeA.intercept) / (edgeA.slope - edgeB.slope);
  if (!Number.isFinite(crossX)) return null;
  if (crossX <= overlapMin + 1e-6 || crossX >= overlapMax - 1e-6) return null;
  return quantizeCoordinate(crossX);
}

function collectDirectionalPrimaryBreakpoints(components, primarySpanMm) {
  const breakpointMap = new Map();
  const addBreakpoint = (value) => {
    const clamped = Math.max(0, Math.min(primarySpanMm, quantizeCoordinate(value)));
    const key = getDocumentationCoordinateKey(clamped);
    if (!breakpointMap.has(key)) breakpointMap.set(key, clamped);
  };

  addBreakpoint(0);
  addBreakpoint(primarySpanMm);

  components.forEach((component) => {
    forEachRing(component.projectedGeometry, (ring) => {
      ring.forEach((point) => addBreakpoint(point[0]));
    });
  });

  const allEdges = components.flatMap((component) =>
    component.projectedEdges.map((edge) => ({
      ...edge,
      componentKey: component.componentKey,
    }))
  );

  for (let index = 0; index < allEdges.length; index += 1) {
    const edgeA = allEdges[index];
    for (let compareIndex = index + 1; compareIndex < allEdges.length; compareIndex += 1) {
      const edgeB = allEdges[compareIndex];
      if (edgeA.componentKey === edgeB.componentKey) continue;
      const crossX = computeProjectedEdgeCrossoverPrimary(edgeA, edgeB);
      if (crossX === null) continue;
      addBreakpoint(crossX);
    }
  }

  const sorted = Array.from(breakpointMap.values()).sort((a, b) => a - b);
  const merged = [];
  sorted.forEach((value) => {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && Math.abs(previous - value) <= 1e-6) return;
    merged.push(value);
  });
  return merged.length >= 2 ? merged : [0, primarySpanMm];
}

function sampleProjectedGeometryDepthIntervals(projectedGeometry, primaryMm) {
  const intersections = [];
  if (!Array.isArray(projectedGeometry) || !projectedGeometry.length) return intersections;

  forEachRing(projectedGeometry, (ring) => {
    for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 1) {
      const start = ring[pointIndex];
      const end = ring[(pointIndex + 1) % ring.length];
      const minX = Math.min(start[0], end[0]);
      const maxX = Math.max(start[0], end[0]);
      const dx = end[0] - start[0];
      if (Math.abs(dx) <= 1e-9) continue;
      if (primaryMm < minX || primaryMm >= maxX) continue;
      const t = (primaryMm - start[0]) / dx;
      const depth = quantizeCoordinate(start[1] + (end[1] - start[1]) * t);
      intersections.push(depth);
    }
  });

  intersections.sort((a, b) => a - b);
  const intervals = [];
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    const start = intersections[index];
    const end = intersections[index + 1];
    if (end - start <= 1e-6) continue;
    intervals.push([start, end]);
  }
  return intervals;
}

function sampleDirectionalComponentFrontDepth(component, primaryMm, frontBoundary = "min") {
  const intervals = sampleProjectedGeometryDepthIntervals(component?.projectedGeometry, primaryMm);
  if (!intervals.length) return null;
  return frontBoundary === "max" ? intervals[intervals.length - 1][1] : intervals[0][0];
}

function sampleDirectionalComponentFrontProfile(component, x1, x2, frontBoundary = "min") {
  const span = Math.max(0, x2 - x1);
  const inset = span > 1e-6 ? Math.min(span * 0.25, Math.max(1e-4, span * 0.05)) : 0;
  const sampleLeftX = quantizeCoordinate(span > 1e-6 ? x1 + inset : x1);
  const sampleRightX = quantizeCoordinate(span > 1e-6 ? x2 - inset : x2);
  const sampleMidX = quantizeCoordinate((x1 + x2) * 0.5);
  const depthStartMm =
    sampleDirectionalComponentFrontDepth(component, sampleLeftX, frontBoundary) ??
    sampleDirectionalComponentFrontDepth(component, sampleMidX, frontBoundary);
  const depthMidMm =
    sampleDirectionalComponentFrontDepth(component, sampleMidX, frontBoundary) ??
    depthStartMm ??
    sampleDirectionalComponentFrontDepth(component, sampleRightX, frontBoundary);
  const depthEndMm =
    sampleDirectionalComponentFrontDepth(component, sampleRightX, frontBoundary) ??
    depthMidMm ??
    depthStartMm;
  if (![depthStartMm, depthMidMm, depthEndMm].every(Number.isFinite)) return null;
  return {
    depthStartMm: quantizeCoordinate(depthStartMm),
    depthMidMm: quantizeCoordinate(depthMidMm),
    depthEndMm: quantizeCoordinate(depthEndMm),
  };
}

function isDirectionalVertexOnFrontProfile(component, vertexPrimaryMm, vertexDepthMm, frontBoundary = "min") {
  const bounds = component?.projectedBounds;
  if (!bounds || bounds.w <= 1e-6) return false;

  const epsilon = Math.max(1e-4, Math.min(0.25, bounds.w * 0.01));
  const sampleXs = [];
  const leftX = vertexPrimaryMm - epsilon;
  const rightX = vertexPrimaryMm + epsilon;
  if (leftX > bounds.x + 1e-6) sampleXs.push(leftX);
  if (rightX < bounds.x + bounds.w - 1e-6) sampleXs.push(rightX);
  if (!sampleXs.length) sampleXs.push(vertexPrimaryMm);

  return sampleXs.some((sampleX) => {
    const frontDepthMm = sampleDirectionalComponentFrontDepth(component, sampleX, frontBoundary);
    return Number.isFinite(frontDepthMm) && isSameDirectionalDepth(frontDepthMm, vertexDepthMm, Math.max(1e-4, epsilon * 2));
  });
}

function collectDirectionalZBreakpoints(foundation) {
  const { intersectingEntries, elevationRangeMm } = foundation;
  const maxZ = Math.max(1, quantizeCoordinate(elevationRangeMm?.maxMm ?? 0));
  const minZ = Math.min(0, quantizeCoordinate(elevationRangeMm?.minMm ?? 0));
  const breakpointMap = new Map();
  const addBreakpoint = (value) => {
    const normalized = quantizeCoordinate(value);
    const key = getDocumentationCoordinateKey(normalized);
    if (!breakpointMap.has(key)) breakpointMap.set(key, normalized);
  };

  addBreakpoint(maxZ);
  addBreakpoint(minZ);
  intersectingEntries.forEach((entry) => {
    addBreakpoint(entry.clippedTopElevationMm);
    addBreakpoint(entry.clippedBaseElevationMm);
  });

  const sorted = Array.from(breakpointMap.values()).sort((a, b) => b - a);
  return sorted.length >= 2 ? sorted : [maxZ, minZ];
}

function chooseDirectionalVisibleSample(samples, zHighMm, zLowMm, frontBoundary = "min") {
  let winner = null;

  samples.forEach((sample) => {
    const component = sample.component;
    const overlapsBand = component.topElevationMm > zLowMm + 1e-6 && component.baseElevationMm < zHighMm - 1e-6;
    if (!overlapsBand) return;
    if (!winner) {
      winner = sample;
      return;
    }

    const depthDelta = sample.depthMidMm - winner.depthMidMm;
    const isCloser = frontBoundary === "max" ? depthDelta > 1e-6 : depthDelta < -1e-6;
    if (isCloser) {
      winner = sample;
      return;
    }

    if (Math.abs(depthDelta) > 1e-6) return;

    const orderDelta = sample.component.stackOrderIndex - winner.component.stackOrderIndex;
    if (orderDelta > 0) {
      winner = sample;
      return;
    }

    if (orderDelta < 0) return;

    if (sample.component.componentKey > winner.component.componentKey) winner = sample;
  });

  return winner;
}

function collectDirectionalEligibleVertexBoundaryLayers(components, frontBoundary = "min") {
  const boundaryMap = new Map();

  components.forEach((component) => {
    forEachRing(component.projectedGeometry, (ring, polygonIndex, ringIndex) => {
      for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 1) {
        if (
          !getVertexOutlineEligibilityAt(
            component.vertexOutlineEligibility,
            polygonIndex,
            ringIndex,
            pointIndex,
            true
          )
        ) {
          continue;
        }
        const point = ring[pointIndex];
        if (!isDirectionalVertexOnFrontProfile(component, point[0], point[1], frontBoundary)) {
          continue;
        }
        const primaryKey = getDocumentationCoordinateKey(point[0]);
        let boundaryInfo = boundaryMap.get(primaryKey);
        if (!boundaryInfo) {
          boundaryInfo = {
            componentKeys: new Set(),
          };
          boundaryMap.set(primaryKey, boundaryInfo);
        }
        boundaryInfo.componentKeys.add(component.componentKey);
      }
    });
  });

  return boundaryMap;
}

function createDocumentationRectGeometry(x1, y1, x2, y2) {
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

function collectDirectionalDocumentationBoundarySegments(documentation, shouldDrawBoundary) {
  const segments = [];
  if (!documentation || !Array.isArray(documentation.cells) || !documentation.cells.length) return segments;

  const { cells, primaryBreaks, yEdges } = documentation;
  const bandCount = cells.length;
  const slabCount = cells[0]?.length || 0;
  if (!bandCount || !slabCount) return segments;

  const cellAt = (bandIndex, slabIndex) =>
    bandIndex >= 0 && bandIndex < bandCount && slabIndex >= 0 && slabIndex < slabCount ? cells[bandIndex][slabIndex] : null;
  const addSegment = (x1, y1, x2, y2) => {
    segments.push({ x1, y1, x2, y2 });
  };
  const evaluateSide = (bandIndex, slabIndex, neighborBandIndex, neighborSlabIndex, x1, y1, x2, y2) => {
    const cell = cellAt(bandIndex, slabIndex);
    if (!cell) return;
    const neighbor = cellAt(neighborBandIndex, neighborSlabIndex);
    if (!shouldDrawBoundary(cell, neighbor)) return;
    addSegment(x1, y1, x2, y2);
  };

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    for (let slabIndex = 0; slabIndex < slabCount; slabIndex += 1) {
      const cell = cells[bandIndex][slabIndex];
      if (!cell) continue;

      const x1 = primaryBreaks[slabIndex];
      const x2 = primaryBreaks[slabIndex + 1];
      const y1 = yEdges[bandIndex];
      const y2 = yEdges[bandIndex + 1];

      evaluateSide(bandIndex, slabIndex, bandIndex - 1, slabIndex, x1, y1, x2, y1);
      evaluateSide(bandIndex, slabIndex, bandIndex, slabIndex + 1, x2, y1, x2, y2);
      evaluateSide(bandIndex, slabIndex, bandIndex + 1, slabIndex, x2, y2, x1, y2);
      evaluateSide(bandIndex, slabIndex, bandIndex, slabIndex - 1, x1, y2, x1, y1);
    }
  }

  return mergeOrthogonalSegments(segments);
}

function buildDirectionalDocumentationVertexSegments(documentation) {
  const segments = [];
  if (!documentation?.cells?.length) return segments;

  const { cells, primaryBreaks, yEdges, eligibleVertexBoundaryLayers } = documentation;
  const bandCount = cells.length;
  const slabCount = cells[0]?.length || 0;

  for (let boundaryIndex = 1; boundaryIndex < primaryBreaks.length - 1; boundaryIndex += 1) {
    const boundaryInfo = eligibleVertexBoundaryLayers.get(getDocumentationCoordinateKey(primaryBreaks[boundaryIndex]));
    if (!boundaryInfo?.componentKeys?.size) continue;
    const boundaryX = primaryBreaks[boundaryIndex];

    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const leftCell = boundaryIndex - 1 >= 0 ? cells[bandIndex][boundaryIndex - 1] : null;
      const rightCell = boundaryIndex < slabCount ? cells[bandIndex][boundaryIndex] : null;
      if (!leftCell || !rightCell) continue;
      if (leftCell.componentKey !== rightCell.componentKey) continue;
      if (!boundaryInfo.componentKeys.has(leftCell.componentKey)) continue;
      if (isSameDirectionalDepth(leftCell.depthEndMm, rightCell.depthStartMm)) continue;
      segments.push({
        x1: boundaryX,
        y1: yEdges[bandIndex],
        x2: boundaryX,
        y2: yEdges[bandIndex + 1],
      });
    }
  }

  return mergeOrthogonalSegments(segments);
}

function buildDirectionalVectorDocumentation(foundation) {
  const { request } = foundation;
  const directionConfig = request?.directionConfig;
  const { primarySpanMm, components } = collectDirectionalDocumentationComponents(foundation);
  if (!components.length || primarySpanMm <= 1e-6) return null;

  const primaryBreaks = collectDirectionalPrimaryBreakpoints(components, primarySpanMm);
  const zBreaksDesc = collectDirectionalZBreakpoints(foundation);
  const slabCount = Math.max(0, primaryBreaks.length - 1);
  const bandCount = Math.max(0, zBreaksDesc.length - 1);
  if (!slabCount || !bandCount) return null;

  const slabSamples = [];
  for (let slabIndex = 0; slabIndex < slabCount; slabIndex += 1) {
    const x1 = primaryBreaks[slabIndex];
    const x2 = primaryBreaks[slabIndex + 1];
    if (x2 - x1 <= 1e-6) {
      slabSamples.push({ x1, x2, samples: [] });
      continue;
    }
    const xMid = quantizeCoordinate((x1 + x2) * 0.5);
    const samples = [];
    components.forEach((component) => {
      if (!boundsTouch(component.projectedBounds, { x: xMid, y: component.projectedBounds.y, w: 0, h: component.projectedBounds.h }, 1e-6)) {
        return;
      }
      const profile = sampleDirectionalComponentFrontProfile(component, x1, x2, directionConfig?.frontBoundary);
      if (!profile) return;
      samples.push({
        component,
        ...profile,
      });
    });
    slabSamples.push({ x1, x2, samples });
  }

  const maxZ = zBreaksDesc[0];
  const minZ = zBreaksDesc[zBreaksDesc.length - 1];
  const zSpanMm = Math.max(1, maxZ - minZ);
  const yEdges = zBreaksDesc.map((zMm) => quantizeCoordinate(maxZ - zMm));
  const cells = Array.from({ length: bandCount }, () => Array(slabCount).fill(null));
  let paintedCellCount = 0;
  let nearestVisibleDepthMm = directionConfig?.frontBoundary === "max" ? -Infinity : Infinity;
  let farthestVisibleDepthMm = directionConfig?.frontBoundary === "max" ? Infinity : -Infinity;

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const zHighMm = zBreaksDesc[bandIndex];
    const zLowMm = zBreaksDesc[bandIndex + 1];
    for (let slabIndex = 0; slabIndex < slabCount; slabIndex += 1) {
      const slab = slabSamples[slabIndex];
      const winner = chooseDirectionalVisibleSample(slab.samples, zHighMm, zLowMm, directionConfig?.frontBoundary);
      if (!winner) continue;

      const cell = {
        layerId: winner.component.layerId,
        sourceShapeKey: winner.component.sourceShapeKey,
        componentKey: winner.component.componentKey,
        fillColor: winner.component.fillColor,
        depthMm: winner.depthMidMm,
        depthStartMm: winner.depthStartMm,
        depthEndMm: winner.depthEndMm,
        stackOrderIndex: winner.component.stackOrderIndex,
        x1: slab.x1,
        x2: slab.x2,
        y1: yEdges[bandIndex],
        y2: yEdges[bandIndex + 1],
        zHighMm,
        zLowMm,
      };

      cells[bandIndex][slabIndex] = cell;
      paintedCellCount += 1;
      if (directionConfig?.frontBoundary === "max") {
        nearestVisibleDepthMm = Math.max(nearestVisibleDepthMm, winner.depthStartMm, winner.depthMidMm, winner.depthEndMm);
        farthestVisibleDepthMm = Math.min(farthestVisibleDepthMm, winner.depthStartMm, winner.depthMidMm, winner.depthEndMm);
      } else {
        nearestVisibleDepthMm = Math.min(nearestVisibleDepthMm, winner.depthStartMm, winner.depthMidMm, winner.depthEndMm);
        farthestVisibleDepthMm = Math.max(farthestVisibleDepthMm, winner.depthStartMm, winner.depthMidMm, winner.depthEndMm);
      }
    }
  }

  if (!paintedCellCount) return null;
  if (!Number.isFinite(nearestVisibleDepthMm)) nearestVisibleDepthMm = 0;
  if (!Number.isFinite(farthestVisibleDepthMm)) farthestVisibleDepthMm = nearestVisibleDepthMm;
  const projectedPrimitives = [];

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    for (let slabIndex = 0; slabIndex < slabCount; slabIndex += 1) {
      const cell = cells[bandIndex][slabIndex];
      if (!cell) continue;
      const depthStrengthRatioStart =
        getDirectionalDepthStrengthRatio(
          cell.depthStartMm,
          nearestVisibleDepthMm,
          farthestVisibleDepthMm,
          directionConfig?.frontBoundary
        );
      const depthStrengthRatioMid =
        getDirectionalDepthStrengthRatio(
          cell.depthMm,
          nearestVisibleDepthMm,
          farthestVisibleDepthMm,
          directionConfig?.frontBoundary
        );
      const depthStrengthRatioEnd =
        getDirectionalDepthStrengthRatio(
          cell.depthEndMm,
          nearestVisibleDepthMm,
          farthestVisibleDepthMm,
          directionConfig?.frontBoundary
        );
      projectedPrimitives.push({
        ...cell,
        geometry: createDocumentationRectGeometry(cell.x1, cell.y1, cell.x2, cell.y2),
        shadedColor: applyRenderDepthShading(cell.fillColor, depthStrengthRatioMid, state.renderSettings),
        shadedColorStart: applyRenderDepthShading(cell.fillColor, depthStrengthRatioStart, state.renderSettings),
        shadedColorEnd: applyRenderDepthShading(cell.fillColor, depthStrengthRatioEnd, state.renderSettings),
      });
    }
  }

  const eligibleVertexBoundaryLayers = collectDirectionalEligibleVertexBoundaryLayers(
    components,
    directionConfig?.frontBoundary
  );
  const massBoundarySegments = collectDirectionalDocumentationBoundarySegments(
    { cells, primaryBreaks, yEdges },
    (cell, neighbor) => !!cell && !neighbor
  );
  const depthTransitionSegments = collectDirectionalDocumentationBoundarySegments(
    { cells, primaryBreaks, yEdges },
    (cell, neighbor) => !!cell && !!neighbor && cell.componentKey !== neighbor.componentKey && !isSameDirectionalDepth(cell.depthMm, neighbor.depthMm)
  );
  const vertexBoundarySegments = buildDirectionalDocumentationVertexSegments({
    cells,
    primaryBreaks,
    yEdges,
    eligibleVertexBoundaryLayers,
  });

  return {
    primarySpanMm,
    minZ,
    maxZ,
    zSpanMm,
    primaryBreaks,
    yEdges,
    cells,
    paintedCellCount,
    projectedPrimitives,
    massBoundarySegments,
    depthTransitionSegments,
    vertexBoundarySegments,
  };
}

function strokeDirectionalDocumentationSegments(context, segments, color, thickness, scale) {
  if (!Array.isArray(segments) || !segments.length) return;
  context.save();
  context.beginPath();
  segments.forEach((segment) => {
    context.moveTo(segment.x1, segment.y1);
    context.lineTo(segment.x2, segment.y2);
  });
  context.strokeStyle = sanitizeColorValue(color, DEFAULT_RENDER_OUTLINE_EFFECT.color);
  context.lineWidth = Math.max(1, Number(thickness) || DEFAULT_RENDER_OUTLINE_EFFECT.thickness) / Math.max(1e-6, scale);
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.stroke();
  context.restore();
}

function paintDirectionalDocumentationFills(context, documentation, originX, originY, scale) {
  if (!documentation?.projectedPrimitives?.length) return;

  const dpr = window.devicePixelRatio || 1;
  const targetWidthPx = Math.max(1, Math.round(documentation.primarySpanMm * scale * dpr));
  const targetHeightPx = Math.max(1, Math.round(documentation.zSpanMm * scale * dpr));
  const maxTargetPx = 8192;
  const clampFactor = Math.min(1, maxTargetPx / Math.max(targetWidthPx, targetHeightPx));
  const paintWidthPx = Math.max(1, Math.round(targetWidthPx * clampFactor));
  const paintHeightPx = Math.max(1, Math.round(targetHeightPx * clampFactor));

  const fillCanvas = document.createElement("canvas");
  fillCanvas.width = paintWidthPx;
  fillCanvas.height = paintHeightPx;
  const fillContext = fillCanvas.getContext("2d");
  if (!fillContext) return;

  fillContext.clearRect(0, 0, paintWidthPx, paintHeightPx);
  fillContext.imageSmoothingEnabled = false;

  const xBoundaryPxByKey = new Map();
  documentation.primaryBreaks.forEach((value) => {
    const px = Math.max(0, Math.min(paintWidthPx, Math.round((value / Math.max(1e-6, documentation.primarySpanMm)) * paintWidthPx)));
    xBoundaryPxByKey.set(getDocumentationCoordinateKey(value), px);
  });
  const yBoundaryPxByKey = new Map();
  documentation.yEdges.forEach((value) => {
    const px = Math.max(0, Math.min(paintHeightPx, Math.round((value / Math.max(1e-6, documentation.zSpanMm)) * paintHeightPx)));
    yBoundaryPxByKey.set(getDocumentationCoordinateKey(value), px);
  });

  documentation.projectedPrimitives.forEach((primitive) => {
    const x1 = xBoundaryPxByKey.get(getDocumentationCoordinateKey(primitive.x1));
    const x2 = xBoundaryPxByKey.get(getDocumentationCoordinateKey(primitive.x2));
    const y1 = yBoundaryPxByKey.get(getDocumentationCoordinateKey(primitive.y1));
    const y2 = yBoundaryPxByKey.get(getDocumentationCoordinateKey(primitive.y2));
    if (![x1, x2, y1, y2].every(Number.isFinite)) return;
    const widthPx = Math.max(0, x2 - x1);
    const heightPx = Math.max(0, y2 - y1);
    if (!widthPx || !heightPx) return;

    if (
      primitive.shadedColorStart &&
      primitive.shadedColorEnd &&
      primitive.shadedColorStart !== primitive.shadedColorEnd &&
      widthPx > 1
    ) {
      const gradient = fillContext.createLinearGradient(x1, y1, x2, y1);
      gradient.addColorStop(0, primitive.shadedColorStart);
      gradient.addColorStop(1, primitive.shadedColorEnd);
      fillContext.fillStyle = gradient;
    } else {
      fillContext.fillStyle = primitive.shadedColor;
    }

    fillContext.fillRect(x1, y1, widthPx, heightPx);
  });

  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(
    fillCanvas,
    originX,
    originY,
    documentation.primarySpanMm * scale,
    documentation.zSpanMm * scale
  );
  context.restore();
}

function pointInGeometryFill(geometry, x, y) {
  return pointInShapeFill({ geometry }, x, y);
}

function getDocumentationSegmentKey(segment) {
  const startKey = `${scaleCoordinateToClipperInt(segment.x1)}:${scaleCoordinateToClipperInt(segment.y1)}`;
  const endKey = `${scaleCoordinateToClipperInt(segment.x2)}:${scaleCoordinateToClipperInt(segment.y2)}`;
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function mergeOrthogonalSegments(segments) {
  if (!Array.isArray(segments) || !segments.length) return [];

  const horizontalGroups = new Map();
  const verticalGroups = new Map();

  segments.forEach((segment) => {
    if (!segment) return;
    if (segment.y1 === segment.y2) {
      const y = segment.y1;
      const start = Math.min(segment.x1, segment.x2);
      const end = Math.max(segment.x1, segment.x2);
      if (!horizontalGroups.has(y)) horizontalGroups.set(y, []);
      horizontalGroups.get(y).push({ x1: start, x2: end, y1: y, y2: y });
      return;
    }
    if (segment.x1 === segment.x2) {
      const x = segment.x1;
      const start = Math.min(segment.y1, segment.y2);
      const end = Math.max(segment.y1, segment.y2);
      if (!verticalGroups.has(x)) verticalGroups.set(x, []);
      verticalGroups.get(x).push({ x1: x, x2: x, y1: start, y2: end });
    }
  });

  const merged = [];

  horizontalGroups.forEach((group) => {
    group.sort((a, b) => a.x1 - b.x1 || a.x2 - b.x2);
    let active = null;
    group.forEach((segment) => {
      if (!active) {
        active = { ...segment };
        return;
      }
      if (segment.x1 <= active.x2) {
        active.x2 = Math.max(active.x2, segment.x2);
        return;
      }
      merged.push(active);
      active = { ...segment };
    });
    if (active) merged.push(active);
  });

  verticalGroups.forEach((group) => {
    group.sort((a, b) => a.y1 - b.y1 || a.y2 - b.y2);
    let active = null;
    group.forEach((segment) => {
      if (!active) {
        active = { ...segment };
        return;
      }
      if (segment.y1 <= active.y2) {
        active.y2 = Math.max(active.y2, segment.y2);
        return;
      }
      merged.push(active);
      active = { ...segment };
    });
    if (active) merged.push(active);
  });

  return merged;
}

function collectPlanDocumentationComponents(foundation) {
  const { request, intersectingEntries } = foundation;
  const widthMm = request?.frame?.widthMm || 0;
  const heightMm = request?.frame?.heightMm || 0;
  const components = [];

  intersectingEntries.forEach((entry) => {
    entry.localSourceComponents.forEach((sourceComponent, sourceIndex) => {
      const geometry = deepCopyGeometry(sourceComponent.localGeometry);
      if (!geometry.length) return;

      components.push({
        componentKey: `${entry.layerId}:${sourceComponent.sourceShapeKey}:${sourceIndex}`,
        layerId: entry.layerId,
        sourceShapeKey: sourceComponent.sourceShapeKey,
        fillColor: sanitizeColorValue(entry.fillColor, "#93c5fd"),
        baseElevationMm: entry.clippedBaseElevationMm,
        topElevationMm: entry.clippedTopElevationMm,
        stackOrderIndex: entry.stackOrderIndex,
        geometry,
        bounds: getGeometryBounds(geometry),
      });
    });
  });

  return {
    widthMm,
    heightMm,
    components,
  };
}

function getPlanVisibleDepthMm(component, frontBoundary = "max") {
  return frontBoundary === "max" ? component.topElevationMm : component.baseElevationMm;
}

function comparePlanDocumentationComponentPriority(a, b, frontBoundary = "max") {
  const depthA = getPlanVisibleDepthMm(a, frontBoundary);
  const depthB = getPlanVisibleDepthMm(b, frontBoundary);
  const depthDelta = depthA - depthB;
  if (Math.abs(depthDelta) > 1e-6) {
    return frontBoundary === "max" ? depthB - depthA : depthA - depthB;
  }

  const orderDelta = b.stackOrderIndex - a.stackOrderIndex;
  if (orderDelta !== 0) return orderDelta;
  if (a.componentKey === b.componentKey) return 0;
  return a.componentKey < b.componentKey ? -1 : 1;
}

function findPlanVisiblePrimitiveAtPoint(primitives, x, y, ignoredComponentKey = null) {
  const point = { x, y };
  for (const primitive of primitives) {
    if (!primitive || primitive.componentKey === ignoredComponentKey) continue;
    if (!pointInRect(point, primitive.bounds, 1e-6)) continue;
    if (pointInGeometryFill(primitive.geometry, x, y)) return primitive;
  }
  return null;
}

function classifyPlanVisiblePrimitiveEdge(primitive, start, end, visiblePrimitives, documentationBounds) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 1e-6)) return null;

  const midpoint = {
    x: quantizeCoordinate((start[0] + end[0]) * 0.5),
    y: quantizeCoordinate((start[1] + end[1]) * 0.5),
  };
  const normal = { x: -dy / length, y: dx / length };
  const maxSpan = Math.max(documentationBounds.widthMm, documentationBounds.heightMm);
  let epsilon = Math.max(1e-4, Math.min(0.25, maxSpan * 0.004, length * 0.125));

  for (let pass = 0; pass < 4; pass += 1) {
    const sampleA = {
      x: quantizeCoordinate(midpoint.x + normal.x * epsilon),
      y: quantizeCoordinate(midpoint.y + normal.y * epsilon),
    };
    const sampleB = {
      x: quantizeCoordinate(midpoint.x - normal.x * epsilon),
      y: quantizeCoordinate(midpoint.y - normal.y * epsilon),
    };
    const insideA = pointInGeometryFill(primitive.geometry, sampleA.x, sampleA.y);
    const insideB = pointInGeometryFill(primitive.geometry, sampleB.x, sampleB.y);

    if (insideA === insideB) {
      epsilon *= 0.5;
      continue;
    }

    const outsidePoint = insideA ? sampleB : sampleA;
    const insideBounds =
      outsidePoint.x >= -epsilon &&
      outsidePoint.x <= documentationBounds.widthMm + epsilon &&
      outsidePoint.y >= -epsilon &&
      outsidePoint.y <= documentationBounds.heightMm + epsilon;
    if (!insideBounds) return "mass";

    const neighbor = findPlanVisiblePrimitiveAtPoint(
      visiblePrimitives,
      outsidePoint.x,
      outsidePoint.y,
      primitive.componentKey
    );
    if (!neighbor) return "mass";
    if (isSameDirectionalDepth(primitive.depthMm, neighbor.depthMm)) return null;
    return "depth";
  }

  return null;
}

function collectPlanDocumentationOutlineSegments(visiblePrimitives, documentationBounds) {
  const massBoundarySegments = [];
  const depthTransitionSegments = [];
  const massKeys = new Set();
  const depthKeys = new Set();

  visiblePrimitives.forEach((primitive) => {
    forEachRing(primitive.geometry, (ring) => {
      for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 1) {
        const start = ring[pointIndex];
        const end = ring[(pointIndex + 1) % ring.length];
        const segment = {
          x1: start[0],
          y1: start[1],
          x2: end[0],
          y2: end[1],
        };
        const classification = classifyPlanVisiblePrimitiveEdge(
          primitive,
          start,
          end,
          visiblePrimitives,
          documentationBounds
        );
        if (!classification) continue;

        const segmentKey = getDocumentationSegmentKey(segment);
        if (classification === "mass") {
          if (massKeys.has(segmentKey)) continue;
          massKeys.add(segmentKey);
          massBoundarySegments.push(segment);
          continue;
        }

        if (classification === "depth") {
          if (depthKeys.has(segmentKey)) continue;
          depthKeys.add(segmentKey);
          depthTransitionSegments.push(segment);
        }
      }
    });
  });

  return {
    massBoundarySegments,
    depthTransitionSegments,
  };
}

function buildPlanVectorDocumentation(foundation) {
  const { request } = foundation;
  const directionConfig = request?.directionConfig;
  const { widthMm, heightMm, components } = collectPlanDocumentationComponents(foundation);
  if (!components.length || widthMm <= 1e-6 || heightMm <= 1e-6) return null;

  const frontBoundary = directionConfig?.frontBoundary || "max";
  const visiblePrimitives = [];
  let coveredGeometry = [];

  components
    .slice()
    .sort((a, b) => comparePlanDocumentationComponentPriority(a, b, frontBoundary))
    .forEach((component) => {
      const visibleGeometry = coveredGeometry.length
        ? differenceGeometry(component.geometry, coveredGeometry)
        : deepCopyGeometry(component.geometry);
      if (!visibleGeometry.length || getGeometryArea(visibleGeometry) <= 1e-6) {
        coveredGeometry = coveredGeometry.length
          ? unionGeometryList([coveredGeometry, component.geometry])
          : deepCopyGeometry(component.geometry);
        return;
      }

      visiblePrimitives.push({
        ...component,
        geometry: visibleGeometry,
        bounds: getGeometryBounds(visibleGeometry),
        depthMm: getPlanVisibleDepthMm(component, frontBoundary),
      });

      coveredGeometry = coveredGeometry.length
        ? unionGeometryList([coveredGeometry, component.geometry])
        : deepCopyGeometry(component.geometry);
    });

  if (!visiblePrimitives.length) return null;

  let nearestVisibleDepthMm = frontBoundary === "max" ? -Infinity : Infinity;
  let farthestVisibleDepthMm = frontBoundary === "max" ? Infinity : -Infinity;
  visiblePrimitives.forEach((primitive) => {
    if (frontBoundary === "max") {
      nearestVisibleDepthMm = Math.max(nearestVisibleDepthMm, primitive.depthMm);
      farthestVisibleDepthMm = Math.min(farthestVisibleDepthMm, primitive.depthMm);
    } else {
      nearestVisibleDepthMm = Math.min(nearestVisibleDepthMm, primitive.depthMm);
      farthestVisibleDepthMm = Math.max(farthestVisibleDepthMm, primitive.depthMm);
    }
  });

  if (!Number.isFinite(nearestVisibleDepthMm)) nearestVisibleDepthMm = 0;
  if (!Number.isFinite(farthestVisibleDepthMm)) farthestVisibleDepthMm = nearestVisibleDepthMm;

  const fillPrimitives = visiblePrimitives.map((primitive) => {
    const depthStrengthRatio = getDirectionalDepthStrengthRatio(
      primitive.depthMm,
      nearestVisibleDepthMm,
      farthestVisibleDepthMm,
      frontBoundary
    );
    return {
      ...primitive,
      shadedColor: applyRenderDepthShading(primitive.fillColor, depthStrengthRatio, state.renderSettings),
    };
  });

  const { massBoundarySegments, depthTransitionSegments } = collectPlanDocumentationOutlineSegments(
    fillPrimitives,
    { widthMm, heightMm }
  );

  return {
    widthMm,
    heightMm,
    nearestVisibleDepthMm,
    farthestVisibleDepthMm,
    fillPrimitives,
    massBoundarySegments,
    depthTransitionSegments,
    outlineSegments: [...massBoundarySegments, ...depthTransitionSegments],
  };
}

function paintPlanDocumentationFills(context, documentation, originX, originY, scale) {
  if (!documentation?.fillPrimitives?.length) return;

  const dpr = window.devicePixelRatio || 1;
  const targetWidthPx = Math.max(1, Math.round(documentation.widthMm * scale * dpr));
  const targetHeightPx = Math.max(1, Math.round(documentation.heightMm * scale * dpr));
  const maxTargetPx = 8192;
  const clampFactor = Math.min(1, maxTargetPx / Math.max(targetWidthPx, targetHeightPx));
  const paintWidthPx = Math.max(1, Math.round(targetWidthPx * clampFactor));
  const paintHeightPx = Math.max(1, Math.round(targetHeightPx * clampFactor));

  const fillCanvas = document.createElement("canvas");
  fillCanvas.width = paintWidthPx;
  fillCanvas.height = paintHeightPx;
  const fillContext = fillCanvas.getContext("2d");
  if (!fillContext) return;

  fillContext.clearRect(0, 0, paintWidthPx, paintHeightPx);
  fillContext.imageSmoothingEnabled = false;

  const toPixelGeometry = (geometry) =>
    transformGeometry(geometry, (point) => ({
      x: Math.max(0, Math.min(paintWidthPx, (point.x / Math.max(1e-6, documentation.widthMm)) * paintWidthPx)),
      y: Math.max(0, Math.min(paintHeightPx, (point.y / Math.max(1e-6, documentation.heightMm)) * paintHeightPx)),
    }));

  documentation.fillPrimitives.forEach((primitive) => {
    const pixelGeometry = toPixelGeometry(primitive.geometry);
    fillContext.beginPath();
    traceGeometryPath(fillContext, pixelGeometry);
    fillContext.fillStyle = primitive.shadedColor;
    fillContext.fill("evenodd");
  });

  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(
    fillCanvas,
    originX,
    originY,
    documentation.widthMm * scale,
    documentation.heightMm * scale
  );
  context.restore();
}

function paintPlanRenderPane(context, width, height, foundation, documentationOverride = null, scaleOverride = null) {
  const documentation = documentationOverride || buildPlanVectorDocumentation(foundation);
  if (!documentation?.fillPrimitives?.length) return false;

  const outlineEffect = cloneRenderOutlineEffect(state.renderSettings?.outlineEffect);
  const boxWidth = documentation.widthMm;
  const boxHeight = documentation.heightMm;
  if (boxWidth <= 1e-6 || boxHeight <= 1e-6) return false;

  const padding = 18;
  const autoScale = Math.min((width - padding * 2) / boxWidth, (height - padding * 2) / boxHeight);
  const scale = Number.isFinite(scaleOverride) && scaleOverride > 0 ? scaleOverride : autoScale;
  if (!Number.isFinite(scale) || scale <= 0) return false;

  const offsetX = (width - boxWidth * scale) * 0.5;
  const offsetY = (height - boxHeight * scale) * 0.5;

  drawRenderPaneBackdrop(context, width, height);

  context.save();
  context.strokeStyle = "rgba(20, 24, 28, 0.14)";
  context.setLineDash([6, 4]);
  context.lineWidth = 1;
  context.strokeRect(offsetX, offsetY, boxWidth * scale, boxHeight * scale);
  context.restore();

  paintPlanDocumentationFills(context, documentation, offsetX, offsetY, scale);

  if (outlineEffect.enabled && documentation.outlineSegments.length) {
    context.save();
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);
    strokeDirectionalDocumentationSegments(
      context,
      documentation.outlineSegments,
      outlineEffect.color,
      outlineEffect.thickness,
      scale
    );
    context.restore();
  }

  return true;
}

function paintDirectionalRenderPane(context, width, height, foundation, documentationOverride = null, scaleOverride = null) {
  const { request } = foundation;
  const documentation = documentationOverride || buildDirectionalVectorDocumentation(foundation);
  const outlineEffect = cloneRenderOutlineEffect(state.renderSettings?.outlineEffect);
  if (!documentation || !documentation.paintedCellCount) return false;

  const primarySpanMm = documentation.primarySpanMm;
  const minZ = documentation.minZ;
  const maxZ = documentation.maxZ;
  const zSpan = documentation.zSpanMm;
  const paddingX = 18;
  const paddingY = 18;
  const autoScale = Math.min((width - paddingX * 2) / primarySpanMm, (height - paddingY * 2) / zSpan);
  const scale = Number.isFinite(scaleOverride) && scaleOverride > 0 ? scaleOverride : autoScale;
  if (!Number.isFinite(scale) || scale <= 0) return false;

  const originX = (width - primarySpanMm * scale) * 0.5;
  const originY = (height - zSpan * scale) * 0.5;
  const zeroLineY = maxZ;

  drawRenderPaneBackdrop(context, width, height);

  if (minZ <= 0 && maxZ >= 0) {
    context.save();
    context.strokeStyle = "rgba(20, 24, 28, 0.14)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(originX, originY + zeroLineY * scale);
    context.lineTo(originX + primarySpanMm * scale, originY + zeroLineY * scale);
    context.stroke();
    context.restore();
  }

  context.save();
  context.strokeStyle = "rgba(20, 24, 28, 0.14)";
  context.setLineDash([6, 4]);
  context.lineWidth = 1;
  context.strokeRect(originX, originY, primarySpanMm * scale, zSpan * scale);
  context.restore();

  paintDirectionalDocumentationFills(context, documentation, originX, originY, scale);

  if (outlineEffect.enabled) {
    context.save();
    context.translate(originX, originY);
    context.scale(scale, scale);
    const outlineSegments = mergeOrthogonalSegments([
      ...documentation.massBoundarySegments,
      ...documentation.depthTransitionSegments,
      ...documentation.vertexBoundarySegments,
    ]);
    strokeDirectionalDocumentationSegments(
      context,
      outlineSegments,
      outlineEffect.color,
      outlineEffect.thickness,
      scale
    );
    context.restore();
  }

  return true;
}

function paintImplementedRenderPane(canvasEl, foundation, options = {}) {
  if (!canvasEl || foundation?.status !== "ready") return false;

  const canvasContext = getRenderPaneCanvasContext(canvasEl);
  if (!canvasContext) return false;

  const { context, width, height } = canvasContext;
  const documentation = options.documentation || null;
  const scaleOverride = options.scaleOverride ?? null;
  switch (foundation.request.direction) {
    case "plan":
      return paintPlanRenderPane(context, width, height, foundation, documentation, scaleOverride);
    case "bottomToTop":
    case "leftToRight":
    case "rightToLeft":
    case "topToBottom":
      return paintDirectionalRenderPane(context, width, height, foundation, documentation, scaleOverride);
    default:
      return false;
  }
}

function renderRenderWorkspaceOutputs() {
  const activeRender = getActiveRenderRecord();
  const compiledScene = activeRender ? compileRenderScene() : null;
  const visiblePaneCount = getVisibleRenderPaneCount();
  const panePaintStates = new Array(renderPaneSlots.length).fill(null);
  let sharedAutoFitScale = null;

  if (activeRender) {
    for (let slotIndex = 0; slotIndex < visiblePaneCount; slotIndex += 1) {
      const direction = getRenderPaneDirection(slotIndex);
      const canPaintDirection = isRenderPanePainterImplemented(direction);
      const foundation = buildRenderPaneFoundation(activeRender, slotIndex, compiledScene);
      const documentation =
        canPaintDirection && foundation.status === "ready" ? buildRenderPaneDocumentation(foundation) : null;
      const paintable = canPaintDirection && isRenderPaneDocumentationPaintable(foundation, documentation);
      panePaintStates[slotIndex] = {
        foundation,
        documentation,
        paintable,
      };
    }

    if (activeRender.syncFit) {
      const fitScales = [];
      for (let slotIndex = 0; slotIndex < visiblePaneCount; slotIndex += 1) {
        const paintState = panePaintStates[slotIndex];
        if (!paintState?.paintable) continue;
        const viewport = getRenderPaneViewportSize(renderPaneCanvases[slotIndex]);
        if (!viewport) continue;
        const fitScale = getRenderPaneAutoFitScale(
          viewport.width,
          viewport.height,
          paintState.foundation,
          paintState.documentation
        );
        if (Number.isFinite(fitScale) && fitScale > 0) {
          fitScales.push(fitScale);
        }
      }
      sharedAutoFitScale = fitScales.length ? Math.min(...fitScales) : null;
    }
  }

  renderPaneSlots.forEach((pane, slotIndex) => {
    const direction = getRenderPaneDirection(slotIndex);
    const directionConfig = getRenderDirectionConfig(direction);
    const titleEl = renderPaneTitles[slotIndex];
    const emptyEl = renderPaneEmptyStates[slotIndex];
    const canvasEl = renderPaneCanvases[slotIndex];
    const sectionRow = renderPaneSectionButtonRows[slotIndex];

    if (titleEl) titleEl.textContent = directionConfig.label;
    if (canvasEl) canvasEl.classList.add("hidden");
    if (emptyEl) emptyEl.classList.remove("hidden");
    if (sectionRow) sectionRow.innerHTML = "";

    renderPaneSelectorButtons.forEach((button) => {
      if (Number(button.dataset.renderSlot) !== slotIndex) return;
      button.classList.toggle("active", button.dataset.renderDirection === direction);
    });

    if (!emptyEl) return;
    if (!activeRender) {
      setRenderPanePlaceholderContent(emptyEl, {
        heading: directionConfig.label,
        lines: ["Select an Rbox tab to start the render workspace."],
      });
      return;
    }

    const paintState =
      panePaintStates[slotIndex] ||
      (() => {
        const foundation = buildRenderPaneFoundation(activeRender, slotIndex, compiledScene);
        const canPaintDirection = isRenderPanePainterImplemented(direction);
        const documentation =
          canPaintDirection && foundation.status === "ready" ? buildRenderPaneDocumentation(foundation) : null;
        return {
          foundation,
          documentation,
          paintable: canPaintDirection && isRenderPaneDocumentationPaintable(foundation, documentation),
        };
      })();
    const foundation = paintState.foundation;
    const painted = paintState.paintable
      ? paintImplementedRenderPane(canvasEl, foundation, {
          documentation: paintState.documentation,
          scaleOverride: sharedAutoFitScale,
        })
      : false;

    if (painted) {
      if (canvasEl) canvasEl.classList.remove("hidden");
      emptyEl.classList.add("hidden");
      return;
    }

    setRenderPanePlaceholderContent(emptyEl, buildRenderPanePlaceholderLines(foundation));
  });

  renderPaneExportButtons.forEach((button) => {
    button.disabled = true;
    button.title = "Render export will be enabled in a later render-engine phase.";
  });
}

function renderWorkspaceSwitcher() {
  if (!workspaceSwitcher) return;
  workspaceSwitcher.innerHTML = "";

  const mainButton = document.createElement("button");
  mainButton.type = "button";
  mainButton.className = "workspace-switcher-button" + (isMainWorkspaceActive() ? " active" : "");
  mainButton.textContent = "Main";
  mainButton.addEventListener("click", () => {
    setActiveWorkspaceTab({ kind: "main" });
  });
  workspaceSwitcher.appendChild(mainButton);

  state.renders
    .slice()
    .reverse()
    .forEach((renderRecord) => {
    const button = document.createElement("button");
    button.type = "button";
    const active = state.activeWorkspaceTab?.kind === "render" && state.activeWorkspaceTab.renderId === renderRecord.id;
    button.className = "workspace-switcher-button" + (active ? " active" : "");
    button.textContent = getRenderTabLabel(renderRecord);
    button.addEventListener("click", () => {
      setActiveWorkspaceTab({ kind: "render", renderId: renderRecord.id });
    });
    workspaceSwitcher.appendChild(button);
    });
}

function renderRenderPopoutNotice(activeRender, { message, buttonLabel = "Close Window" } = {}) {
  if (!renderPopoutNotice) return;
  renderPopoutNotice.innerHTML = "";

  const title = document.createElement("div");
  title.textContent = message;
  renderPopoutNotice.appendChild(title);

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.className = "render-layout-button render-layout-toolbar-button";
  actionButton.textContent = buttonLabel;
  actionButton.addEventListener("click", () => {
    if (isRenderPopoutWindow()) {
      try {
        window.close();
      } catch {}
      return;
    }
    closeTrackedRenderPopout();
  });
  renderPopoutNotice.appendChild(actionButton);
}

function syncRenderWorkspaceShell() {
  const validRenderIds = new Set(state.renders.map((render) => render.id));
  state.activeWorkspaceTab = cloneActiveWorkspaceTab(state.activeWorkspaceTab, validRenderIds);

  const activeRender = getActiveRenderRecord();
  if (canvasShell) {
    canvasShell.classList.toggle("render-workspace-mode", !!activeRender || isRenderPopoutWindow());
  }
  if (renderWorkspaceShell) {
    renderWorkspaceShell.setAttribute("aria-hidden", String(!activeRender && !isRenderPopoutWindow()));
  }
  if (renderSyncFitButton) {
    const syncFitEnabled = activeRender?.syncFit === true;
    renderSyncFitButton.classList.toggle("active", syncFitEnabled);
    renderSyncFitButton.setAttribute("aria-pressed", String(syncFitEnabled));
    renderSyncFitButton.disabled = !activeRender;
  }
  if (renderPopoutButton) {
    renderPopoutButton.textContent = isRenderPopoutWindow() ? "Close Window" : "Open in New Window";
    renderPopoutButton.disabled = !activeRender && !isRenderPopoutWindow();
  }

  const visiblePaneCount = getVisibleRenderPaneCount();
  for (const button of renderLayoutButtons) {
    button.classList.toggle("active", Number(button.dataset.renderLayout) === visiblePaneCount);
  }
  if (renderOutputGrid) {
    renderOutputGrid.classList.toggle("layout-1", visiblePaneCount === 1);
    renderOutputGrid.classList.toggle("layout-2", visiblePaneCount === 2);
    renderOutputGrid.classList.toggle("layout-4", visiblePaneCount === 4);
  }
  renderPaneSlots.forEach((pane, index) => {
    pane.classList.toggle("hidden", index >= visiblePaneCount);
  });

  const externalizedInMain = !!activeRender && isRenderExternalized(activeRender.id);
  const popoutMissingTarget = isRenderPopoutWindow() && !activeRender;
  const showNotice = externalizedInMain || popoutMissingTarget;

  if (renderLayoutToolbar) {
    renderLayoutToolbar.classList.toggle("hidden", externalizedInMain || popoutMissingTarget);
  }
  if (renderOutputGrid) {
    renderOutputGrid.classList.toggle("hidden", showNotice);
  }
  if (renderPopoutNotice) {
    renderPopoutNotice.classList.toggle("hidden", !showNotice);
    if (showNotice) {
      if (externalizedInMain) {
        renderRenderPopoutNotice(activeRender, {
          message: `${getRenderTabLabel(activeRender)} is open in another window.`,
          buttonLabel: "Close Window",
        });
      } else if (popoutMissingTarget) {
        renderRenderPopoutNotice(activeRender, {
          message: "This Rbox is no longer available in the main window.",
          buttonLabel: "Close Window",
        });
      }
    } else {
      renderPopoutNotice.innerHTML = "";
    }
  }

  if (isRenderPopoutWindow()) {
    document.title = activeRender ? `${getRenderTabLabel(activeRender)} | millimétré` : "Render Pop-out | millimétré";
  }
}

function renderWorkspaceUi() {
  const activeRender = getActiveRenderRecord();
  if (activeRender) {
    syncRenderWorkspaceStateFromRecord(activeRender);
  } else {
    state.renderLayoutPreset = sanitizeRenderLayoutPreset(state.renderLayoutPreset, 1);
    state.renderPaneDirectionProfiles = cloneRenderPaneDirectionProfiles(state.renderPaneDirectionProfiles);
  }
  renderWorkspaceSwitcher();
  syncRenderWorkspaceShell();
  if (!isRenderPopoutWindow() && activeRender && isRenderExternalized(activeRender.id)) {
    return;
  }
  if (isRenderPopoutWindow() && !activeRender) {
    return;
  }
  renderRenderWorkspaceOutputs();
}

function createProjectFilePayload() {
  const renderIds = new Set(state.renders.map((render) => render.id));
  return {
    app: PROJECT_FILE_APP_ID,
    version: PROJECT_FILE_VERSION,
    document: {
      drawingsUi: state.drawingsUi.map((drawing) => ({
        id: drawing.id,
        name: drawing.name,
        expanded: drawing.expanded === true,
        visible: drawing.visible !== false,
        layersSectionCollapsed: drawing.layersSectionCollapsed === true,
      })),
      layers: state.layers.map((layer) => ({
        id: layer.id,
        drawingId: getLayerDrawingId(layer),
        name: layer.name,
        visible: layer.visible !== false,
        locked: layer.locked === true,
        fillColor: sanitizeColorValue(layer.fillColor, getNextLayerColor()),
        opacity: Math.max(0, Math.min(1, Number.isFinite(layer.opacity) ? layer.opacity : 1)),
        render: cloneLayerRenderSettings(layer.render),
      })),
      shapes: state.shapes.map((shape) => ({
        id: shape.id,
        layerId: shape.layerId,
        geometry: deepCopyGeometry(shape.geometry),
        vertexOutlineEligibility: deepCopyVertexOutlineEligibility(shape.vertexOutlineEligibility),
      })),
      renders: state.renders.map((render) => cloneRenderRecord(render)),
      activeDrawingId: state.activeDrawingId,
      activeLayerId: state.activeLayerId,
      nextDrawingId: sanitizeProjectCounter(state.nextDrawingId, 1),
      nextLayerId: sanitizeProjectCounter(state.nextLayerId, 1),
      nextShapeId: sanitizeProjectCounter(state.nextShapeId, 1),
      nextRenderId: sanitizeProjectCounter(state.nextRenderId, 1),
    },
    workspace: {
      tool: sanitizeProjectTool(state.tool, "draw"),
      shapeType: sanitizeProjectShapeType(state.shapeType, "rect"),
      drawSize: sanitizeProjectSizeControl(state.drawSize, 1),
      stripCellWidth: sanitizeProjectSizeControl(state.stripCellWidth, 1),
      activeWorkspaceTab: cloneActiveWorkspaceTab(state.activeWorkspaceTab, renderIds),
      renderLayoutPreset: sanitizeRenderLayoutPreset(state.renderLayoutPreset, 1),
      renderPaneDirectionProfiles: cloneRenderPaneDirectionProfiles(state.renderPaneDirectionProfiles),
      layerSectionCollapsed: state.layerSectionCollapsed === true,
      layerSettingsUi: cloneLayerSettingsUiMemory(state.layerSettingsUi, state.drawingsUi.map((drawing) => drawing.id)),
      renderSettings: cloneRenderSettings(state.renderSettings),
      settings: cloneSettings(state.settings),
      draftOrigin: sanitizeProjectPoint(state.draftOrigin, { x: 0, y: 0 }, true),
      camera: sanitizeProjectCamera(state.camera, { x: 0, y: 0, zoom: 1 }),
      selectionShapeIds: normalizeSelectedShapeIds(state.selection.shapeIds),
    },
    draftAngle: cloneProjectDraftAngleSnapshot(),
  };
}

function serializeProjectFile() {
  return JSON.stringify(createProjectFilePayload(), null, 2);
}

function getDerivedNextIdFromRecords(records, prefix) {
  let maxIndex = 0;
  const matcher = new RegExp(`^${prefix}(\\d+)$`);

  for (const record of records) {
    const match = matcher.exec(record.id);
    if (!match) continue;
    maxIndex = Math.max(maxIndex, Number(match[1]));
  }

  return maxIndex + 1;
}

function normalizeImportedDrawingRecords(drawingsUi) {
  if (!Array.isArray(drawingsUi) || !drawingsUi.length) {
    throw createProjectImportError("Unsupported project file: missing drawings.");
  }

  const seenIds = new Set();
  return drawingsUi.map((drawing, index) => {
    if (!isPlainObject(drawing)) {
      throw createProjectImportError("Unsupported project file: invalid drawing record.");
    }

    const id = typeof drawing.id === "string" ? drawing.id.trim() : "";
    if (!id || seenIds.has(id)) {
      throw createProjectImportError("Unsupported project file: drawing ids must be unique.");
    }
    seenIds.add(id);

    return {
      id,
      name:
        typeof drawing.name === "string" && drawing.name.trim()
          ? drawing.name.trim()
          : `Drawing ${index + 1}`,
      expanded: drawing.expanded === true,
      visible: drawing.visible !== false,
      layersSectionCollapsed: drawing.layersSectionCollapsed === true,
    };
  });
}

function normalizeImportedLayerRecords(layers, drawingIds) {
  if (!Array.isArray(layers) || !layers.length) {
    throw createProjectImportError("Unsupported project file: missing layers.");
  }

  const seenIds = new Set();
  return layers.map((layer, index) => {
    if (!isPlainObject(layer)) {
      throw createProjectImportError("Unsupported project file: invalid layer record.");
    }

    const id = typeof layer.id === "string" ? layer.id.trim() : "";
    const drawingId = typeof layer.drawingId === "string" ? layer.drawingId.trim() : "";
    if (!id || seenIds.has(id)) {
      throw createProjectImportError("Unsupported project file: layer ids must be unique.");
    }
    if (!drawingIds.has(drawingId)) {
      throw createProjectImportError("Unsupported project file: layer references a missing drawing.");
    }
    seenIds.add(id);

    return {
      id,
      drawingId,
      name:
        typeof layer.name === "string" && layer.name.trim()
          ? layer.name.trim()
          : `Layer ${index + 1}`,
      visible: layer.visible !== false,
      locked: layer.locked === true,
      fillColor: sanitizeColorValue(layer.fillColor, layerPalette[index % layerPalette.length]),
      opacity: Math.max(0, Math.min(1, Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1)),
      render: cloneLayerRenderSettings(layer.render),
    };
  });
}

function normalizeImportedRenderRecords(renders, workspaceFallback = null) {
  if (!Array.isArray(renders)) {
    throw createProjectImportError("Unsupported project file: invalid render records.");
  }

  const fallbackLayoutPreset = cloneRenderLayoutPreset(workspaceFallback?.renderLayoutPreset);
  const fallbackPaneDirectionProfiles = cloneRenderPaneDirectionProfiles(
    workspaceFallback?.renderPaneDirectionProfiles,
    workspaceFallback?.renderPaneDirections
  );

  const seenIds = new Set();
  return renders.map((render, index) => {
    if (!isPlainObject(render)) {
      throw createProjectImportError("Unsupported project file: invalid render record.");
    }

    const id = typeof render.id === "string" ? render.id.trim() : "";
    if (!id || seenIds.has(id)) {
      throw createProjectImportError("Unsupported project file: render ids must be unique.");
    }
    if (!Array.isArray(render.boxGeometry)) {
      throw createProjectImportError("Unsupported project file: render box geometry is invalid.");
    }
    seenIds.add(id);

    return {
      id,
      name:
        typeof render.name === "string" && render.name.trim()
          ? render.name.trim()
          : `Rbox ${index + 1}`,
      visible: render.visible !== false,
      layoutPreset: cloneRenderLayoutPreset(render.layoutPreset ?? fallbackLayoutPreset),
      paneDirectionProfiles: cloneRenderPaneDirectionProfiles(
        render.paneDirectionProfiles,
        fallbackPaneDirectionProfiles[cloneRenderLayoutPreset(render.layoutPreset ?? fallbackLayoutPreset)]
      ),
      syncFit: cloneRenderSyncFit(render.syncFit),
      boxGeometry: cloneRenderBoxGeometry(render.boxGeometry),
      volume: cloneRenderVolumeSettings(render.volume),
      sectionSettings: cloneRenderSectionSettings(render.sectionSettings),
    };
  });
}

function normalizeImportedShapeRecords(shapes, layerIds) {
  if (!Array.isArray(shapes)) {
    throw createProjectImportError("Unsupported project file: missing shapes.");
  }

  const seenIds = new Set();
  return shapes.map((shape) => {
    if (!isPlainObject(shape)) {
      throw createProjectImportError("Unsupported project file: invalid shape record.");
    }

    const id = typeof shape.id === "string" ? shape.id.trim() : "";
    const layerId = typeof shape.layerId === "string" ? shape.layerId.trim() : "";
    if (!id || seenIds.has(id)) {
      throw createProjectImportError("Unsupported project file: shape ids must be unique.");
    }
    if (!layerIds.has(layerId)) {
      throw createProjectImportError("Unsupported project file: shape references a missing layer.");
    }

    const shapeRecord = createShapeRecord(layerId, shape.geometry, id, {
      vertexOutlineEligibility: shape.vertexOutlineEligibility,
    });
    if (!shapeRecord) {
      throw createProjectImportError("Unsupported project file: shape geometry is invalid.");
    }

    seenIds.add(id);
    return shapeRecord;
  });
}

function normalizeImportedDraftAngleState(draftAngle) {
  if (!isPlainObject(draftAngle)) {
    throw createProjectImportError("Unsupported project file: missing draft-angle state.");
  }

  if (!Array.isArray(draftAngle.familyRecords) || !draftAngle.familyRecords.length) {
    throw createProjectImportError("Unsupported project file: draft-angle family records are invalid.");
  }

  const familyRecords = draftAngle.familyRecords.map((record) => {
    if (!isPlainObject(record)) {
      throw createProjectImportError("Unsupported project file: invalid draft-angle family record.");
    }
    return { ...record };
  });

  if (draftAngle.candidateRecord !== null && draftAngle.candidateRecord !== undefined && !isPlainObject(draftAngle.candidateRecord)) {
    throw createProjectImportError("Unsupported project file: invalid draft-angle candidate record.");
  }

  if (draftAngle.activeState !== null && draftAngle.activeState !== undefined && !isPlainObject(draftAngle.activeState)) {
    throw createProjectImportError("Unsupported project file: invalid draft-angle active state.");
  }

  return {
    nextFamilyId: sanitizeProjectCounter(draftAngle.nextFamilyId, 1),
    familyRecords,
    candidateRecord: draftAngle.candidateRecord ? { ...draftAngle.candidateRecord } : null,
    activeState: draftAngle.activeState ? { ...draftAngle.activeState } : null,
  };
}

function normalizeImportedProjectFile(payload) {
  if (!isPlainObject(payload)) {
    throw createProjectImportError("Unsupported project file.");
  }

  if (payload.app !== PROJECT_FILE_APP_ID) {
    throw createProjectImportError("Unsupported project file.");
  }

  if (payload.version !== PROJECT_FILE_VERSION) {
    throw createProjectImportError(`Unsupported project file version: ${String(payload.version)}.`);
  }

  if (!isPlainObject(payload.document) || !isPlainObject(payload.workspace)) {
    throw createProjectImportError("Unsupported project file.");
  }

  const drawingsUi = normalizeImportedDrawingRecords(payload.document.drawingsUi);
  const drawingIds = new Set(drawingsUi.map((drawing) => drawing.id));
  const layers = normalizeImportedLayerRecords(payload.document.layers, drawingIds);
  const layerIds = new Set(layers.map((layer) => layer.id));
  const shapes = normalizeImportedShapeRecords(payload.document.shapes, layerIds);
  const renders = normalizeImportedRenderRecords(payload.document.renders, payload.workspace);
  const renderIds = new Set(renders.map((render) => render.id));
  const draftAngle = normalizeImportedDraftAngleState(payload.draftAngle);
  const activeWorkspaceTab = cloneActiveWorkspaceTab(payload.workspace.activeWorkspaceTab, renderIds);
  const layerSettingsUi = normalizeImportedLayerSettingsUiMemory(payload.workspace.layerSettingsUi, drawingsUi.map((drawing) => drawing.id));

  for (const drawing of drawingsUi) {
    if (!layers.some((layer) => layer.drawingId === drawing.id)) {
      throw createProjectImportError("Unsupported project file: each drawing must contain at least one layer.");
    }
  }

  const activeDrawingId =
    typeof payload.document.activeDrawingId === "string" && drawingIds.has(payload.document.activeDrawingId)
      ? payload.document.activeDrawingId
      : drawingsUi[0].id;

  const activeLayerId =
    typeof payload.document.activeLayerId === "string" &&
    layerIds.has(payload.document.activeLayerId) &&
    layers.some((layer) => layer.id === payload.document.activeLayerId && layer.drawingId === activeDrawingId)
      ? payload.document.activeLayerId
      : getDrawingLayerFallbackFromRecords(layers, activeDrawingId)?.id || layers[0].id;

  return {
    document: {
      drawingsUi: drawingsUi.map((drawing) => ({
        ...drawing,
        expanded: drawing.id === activeDrawingId,
      })),
      layers,
      shapes,
      activeDrawingId,
      activeLayerId,
      nextDrawingId: Math.max(
        sanitizeProjectCounter(payload.document.nextDrawingId, 1),
        getDerivedNextIdFromRecords(drawingsUi, "drawing-")
      ),
      nextLayerId: Math.max(
        sanitizeProjectCounter(payload.document.nextLayerId, 1),
        getDerivedNextIdFromRecords(layers, "layer-")
      ),
      nextShapeId: Math.max(
        sanitizeProjectCounter(payload.document.nextShapeId, 1),
        getDerivedNextIdFromRecords(shapes, "shape-")
      ),
      renders,
      nextRenderId: Math.max(
        sanitizeProjectCounter(payload.document.nextRenderId, 1),
        getDerivedNextIdFromRecords(renders, "render-")
      ),
    },
    workspace: {
      tool: sanitizeProjectTool(payload.workspace.tool, "draw"),
      shapeType: sanitizeProjectShapeType(payload.workspace.shapeType, "rect"),
      drawSize: sanitizeProjectSizeControl(payload.workspace.drawSize, 1),
      stripCellWidth: sanitizeProjectSizeControl(payload.workspace.stripCellWidth, 1),
      activeWorkspaceTab,
      renderLayoutPreset: sanitizeRenderLayoutPreset(payload.workspace.renderLayoutPreset, 1),
      renderPaneDirectionProfiles: cloneRenderPaneDirectionProfiles(
        payload.workspace.renderPaneDirectionProfiles,
        payload.workspace.renderPaneDirections
      ),
      layerSectionCollapsed: payload.workspace.layerSectionCollapsed === true,
      layerSettingsUi,
      renderSettings: cloneRenderSettings(payload.workspace.renderSettings),
      settings: cloneSettings(payload.workspace.settings),
      draftOrigin: sanitizeProjectPoint(payload.workspace.draftOrigin, { x: 0, y: 0 }, true),
      camera: sanitizeProjectCamera(payload.workspace.camera, { x: 0, y: 0, zoom: 1 }),
      selectionShapeIds: Array.isArray(payload.workspace.selectionShapeIds)
        ? payload.workspace.selectionShapeIds.filter((shapeId) => typeof shapeId === "string")
        : [],
    },
    draftAngle,
  };
}

function getDrawingLayerFallbackFromRecords(layers, drawingId) {
  return layers.filter((layer) => layer.drawingId === drawingId).slice().reverse()[0] || null;
}

function replaceDraftAngleStoreFromSnapshot(snapshot) {
  draftAngleStore = createDraftAngleStore({
    precisionDecimals: geometryPrecisionDecimals,
    nextFamilyId: snapshot.nextFamilyId,
    familyRecords: snapshot.familyRecords,
    candidateRecord: snapshot.candidateRecord,
    activeState: snapshot.activeState,
  });
  window.draftAngleStore = draftAngleStore;
}

function resetProjectInteractionState() {
  cancelDrawInteraction();
  cancelSelectionInteraction();
  closeExportFallbackMenu();
  closeLayerSettingsModal();
  closeRenderSettingsMenu();
  state.panning = false;
  state.draggingDraftOrigin = false;
  cancelDraftAlignDrag();
  state.pointerInCanvas = false;
  state.pointerScreen = { x: 0, y: 0 };
  state.start = { x: 0, y: 0 };
  state.current = { x: 0, y: 0 };
  state.draftStart = { x: 0, y: 0 };
  state.draftCurrent = { x: 0, y: 0 };
  state.panStart = { x: 0, y: 0 };
  state.panOrigin = { x: 0, y: 0 };
  state.leftPanelPointerDrag = null;
  state.layerSettingsPointerDrag = null;
  state.draftOriginDragStartScreen = { x: 0, y: 0 };
  state.draftOriginDragStartOrigin = { x: 0, y: 0 };
  state.draftOriginDragRotation = null;
  state.draftAlignStartSnap = null;
  state.draftAlignCurrentSnap = null;
  state.squareBrushMemoryPoint = null;
  state.settingsDraft = null;
  state.renderSettingsDraft = null;
  state.layerSettingsDraft = null;
  state.layerSettingsUi = {
    collapsedByDrawingId: {},
    scrollTop: 0,
  };
  state.renderSectionCollapsed = false;
  state.editingDrawingId = null;
  state.editingDrawingNameDraft = "";
  state.editingDrawingInitialName = "";
  state.editingLayerId = null;
  state.editingLayerNameDraft = "";
  state.editingLayerInitialName = "";
  state.editingRenderId = null;
  state.editingRenderNameDraft = "";
  state.editingRenderInitialName = "";
  state.activeRenderId = null;
  state.renderTransformDrag = null;
  state.pendingRenderBox = null;
  state.renderLayoutPreset = 1;
  state.renderPaneDirectionProfiles = cloneRenderPaneDirectionProfiles(DEFAULT_RENDER_PANE_DIRECTION_PROFILES);
  state.renderBoxPropertiesDraft = null;
  state.spacePressed = false;
  state.shiftPressed = false;

  if (layersPanel) layersPanel.classList.remove("drag-reordering");
  clearLeftPanelDropIndicatorClasses(layersList);
  clearLayerTransferTargetClasses(layersList);
  clearLayerMergeTargetClasses(layersList);
}

function applyImportedProject(normalizedProject, importedFileName = DEFAULT_PROJECT_FILE_NAME) {
  resetProjectInteractionState();
  closeSettingsMenu();
  state.drawingsUi = normalizedProject.document.drawingsUi.map((drawing) => ({ ...drawing }));
  state.layerSectionCollapsed = normalizedProject.workspace.layerSectionCollapsed;
  state.layers = normalizedProject.document.layers.map((layer) => ({
    ...layer,
    render: cloneLayerRenderSettings(layer.render),
  }));
  state.shapes = normalizedProject.document.shapes.map((shape) => cloneShape(shape));
  state.renders = normalizedProject.document.renders.map((render) => cloneRenderRecord(render));
  state.nextDrawingId = normalizedProject.document.nextDrawingId;
  state.nextLayerId = normalizedProject.document.nextLayerId;
  state.nextShapeId = normalizedProject.document.nextShapeId;
  state.nextRenderId = normalizedProject.document.nextRenderId;
  state.activeWorkspaceTab = cloneActiveWorkspaceTab(normalizedProject.workspace.activeWorkspaceTab, new Set(state.renders.map((render) => render.id)));
  state.activeRenderId = null;
  state.renderLayoutPreset = sanitizeRenderLayoutPreset(normalizedProject.workspace.renderLayoutPreset, 1);
  state.renderPaneDirectionProfiles = cloneRenderPaneDirectionProfiles(normalizedProject.workspace.renderPaneDirectionProfiles);
  state.settings = cloneSettings(normalizedProject.workspace.settings);
  state.renderSettings = cloneRenderSettings(normalizedProject.workspace.renderSettings);
  state.layerSettingsUi = cloneLayerSettingsUiMemory(
    normalizedProject.workspace.layerSettingsUi,
    normalizedProject.document.drawingsUi.map((drawing) => drawing.id)
  );
  state.projectFileName = sanitizeProjectFileName(importedFileName, state.projectFileName);
  state.draftOrigin = { ...normalizedProject.workspace.draftOrigin };
  state.camera = { ...normalizedProject.workspace.camera };
  state.tool = normalizedProject.workspace.tool;
  state.shapeType = normalizedProject.workspace.shapeType;
  state.drawSize = normalizedProject.workspace.drawSize;
  state.stripCellWidth = normalizedProject.workspace.stripCellWidth;
  replaceDraftAngleStoreFromSnapshot(normalizedProject.draftAngle);
  setActiveDrawingById(normalizedProject.document.activeDrawingId, {
    layerId: normalizedProject.document.activeLayerId,
  });
  setSelectedShapeIds(normalizedProject.workspace.selectionShapeIds);
  resetSelectionInteraction();
  syncToolControls();
  shapeSelect.value = state.shapeType;
  syncDrawSizeInput();
  updateZoomLabel();
  updateGridStatus();
  updateWorkplaneStatus();
  updateCursor();
  renderLayersPanel();
  renderLiveRegistry();
  render();

  if (isRenderPopoutMainController() && renderPopoutSession.openRenderId) {
    const trackedRender = getRenderById(renderPopoutSession.openRenderId);
    if (trackedRender) {
      syncTrackedRenderPopout("import-project");
    } else {
      closeTrackedRenderPopout();
    }
  }
}

function initializeRenderPopoutWindowFromSnapshot() {
  if (!isRenderPopoutWindow()) return false;
  ensureRenderPopoutChannel();

  let snapshotPayload = null;
  try {
    const rawPayload = renderPopoutSession.snapshotKey ? localStorage.getItem(renderPopoutSession.snapshotKey) : null;
    snapshotPayload = rawPayload ? JSON.parse(rawPayload) : null;
  } catch {
    snapshotPayload = null;
  }

  if (isPlainObject(snapshotPayload)) {
    applyRenderPopoutMirrorPayload(snapshotPayload);
    return true;
  }

  state.activeWorkspaceTab = { kind: "main" };
  state.activeRenderId = null;
  renderWorkspaceUi();
  render();
  return false;
}

async function exportProjectToFile() {
  if (typeof window.showSaveFilePicker !== "function") {
    const downloadUrl = URL.createObjectURL(
      new Blob([serializeProjectFile()], {
        type: "application/json",
      })
    );
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = sanitizeProjectFileName(state.projectFileName, DEFAULT_PROJECT_FILE_NAME);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    if (!state.exportFallbackNoticeShown) {
      state.exportFallbackNoticeShown = true;
      openExportFallbackMenu();
    }
    return;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: sanitizeProjectFileName(state.projectFileName, DEFAULT_PROJECT_FILE_NAME),
    types: [
      {
        description: "Millimetre Project",
        accept: {
          "application/json": [".json"],
        },
      },
    ],
  });

  const writable = await handle.createWritable();
  await writable.write(serializeProjectFile());
  await writable.close();
  state.projectFileName = sanitizeProjectFileName(handle.name, state.projectFileName);
}

async function handleProjectExport() {
  try {
    await exportProjectToFile();
  } catch (error) {
    if (error?.name === "AbortError") return;
    window.alert(error instanceof Error ? error.message : "Project export failed.");
  }
}

async function handleProjectImportFile(file) {
  if (!file) return;
  if (!window.confirm("Import will replace the current project. Continue?")) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const normalizedProject = normalizeImportedProjectFile(payload);
    applyImportedProject(normalizedProject, file.name || DEFAULT_PROJECT_FILE_NAME);
  } catch (error) {
    if (error instanceof SyntaxError) {
      window.alert("Unsupported project file: invalid JSON.");
      return;
    }
    window.alert(error instanceof Error ? error.message : "Project import failed.");
  }
}

function isLayerSettingsMenuOpen() {
  return !!layerSettingsModal && !layerSettingsModal.classList.contains("hidden");
}

function createLayerSettingsDraft() {
  const layerSettingsUi = cloneLayerSettingsUiMemory(state.layerSettingsUi, state.drawingsUi.map((drawing) => drawing.id));
  return {
    drawings: state.drawingsUi.map((drawing) => ({
      drawingId: drawing.id,
      name: drawing.name,
      collapsed:
        Object.prototype.hasOwnProperty.call(layerSettingsUi.collapsedByDrawingId, drawing.id)
          ? layerSettingsUi.collapsedByDrawingId[drawing.id] === true
          : drawing.id !== state.activeDrawingId,
      items: getLayersForDrawing(drawing.id).map((layer) => {
        const renderSettings = cloneLayerRenderSettings(layer.render);
        return {
          layerId: layer.id,
          name: layer.name,
          baseElevationMm: renderSettings.baseElevationMm,
          heightMm: renderSettings.heightMm,
        };
      }),
    })),
  };
}

function syncLayerSettingsUiMemoryFromDraft() {
  const drawingIds = Array.isArray(state.layerSettingsDraft?.drawings)
    ? state.layerSettingsDraft.drawings.map((drawing) => drawing.drawingId)
    : state.drawingsUi.map((drawing) => drawing.id);
  const nextMemory = cloneLayerSettingsUiMemory(state.layerSettingsUi, drawingIds);
  if (Array.isArray(state.layerSettingsDraft?.drawings)) {
    nextMemory.collapsedByDrawingId = {};
    state.layerSettingsDraft.drawings.forEach((drawing) => {
      nextMemory.collapsedByDrawingId[drawing.drawingId] = drawing.collapsed === true;
    });
  }
  if (layerSettingsBody) {
    nextMemory.scrollTop = sanitizeLayerSettingsScrollTop(layerSettingsBody.scrollTop);
  }
  state.layerSettingsUi = nextMemory;
}

function getLayerSettingsGroupStartMm(group) {
  if (!group?.items?.length) return 0;
  return Math.min(...group.items.map((item) => item.baseElevationMm));
}

function getLayerSettingsGroupEndMm(group) {
  if (!group?.items?.length) return 0;
  return Math.max(...group.items.map((item) => item.baseElevationMm + item.heightMm));
}

function getLayerSettingsGroupHeightMm(group) {
  return quantizeCoordinate(getLayerSettingsGroupEndMm(group) - getLayerSettingsGroupStartMm(group));
}

function clearLayerSettingsDropIndicatorClasses(itemSelector) {
  if (!layerSettingsDrawingList) return;
  layerSettingsDrawingList.querySelectorAll(itemSelector).forEach((item) => {
    item.classList.remove("drag-insert-before");
    item.classList.remove("drag-insert-after");
  });
}

function layerSettingsDrawingDropPosition(clientY, drawingId) {
  const draft = state.layerSettingsDraft;
  if (!draft || !draft.drawings.length || !layerSettingsDrawingList) {
    return { rawIndex: -1, toIndex: -1, fromIndex: -1 };
  }

  const fromIndex = draft.drawings.findIndex((group) => group.drawingId === drawingId);
  if (fromIndex === -1) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const groups = Array.from(layerSettingsDrawingList.querySelectorAll(".layer-settings-drawing-group"));
  if (!groups.length) return { rawIndex: fromIndex, toIndex: fromIndex, fromIndex };

  let rawIndex = groups.length;
  for (let index = 0; index < groups.length; index += 1) {
    const rect = groups[index].getBoundingClientRect();
    if (clientY < rect.top + rect.height * 0.5) {
      rawIndex = index;
      break;
    }
  }

  let toIndex = rawIndex;
  if (toIndex > fromIndex) toIndex -= 1;

  return {
    rawIndex,
    toIndex: Math.max(0, Math.min(draft.drawings.length - 1, toIndex)),
    fromIndex,
  };
}

function layerSettingsLayerDropPosition(clientY, layerId, drawingId) {
  const draft = state.layerSettingsDraft;
  if (!draft || !layerSettingsDrawingList) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const group = draft.drawings.find((entry) => entry.drawingId === drawingId);
  if (!group) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const fromIndex = group.items.findIndex((entry) => entry.layerId === layerId);
  if (fromIndex === -1) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const groupEl = layerSettingsDrawingList.querySelector(`.layer-settings-drawing-group[data-drawing-id="${drawingId}"]`);
  const rows = groupEl ? Array.from(groupEl.querySelectorAll(".layer-settings-row")) : [];
  if (!rows.length) return { rawIndex: fromIndex, toIndex: fromIndex, fromIndex };

  let rawIndex = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const rect = rows[index].getBoundingClientRect();
    if (clientY < rect.top + rect.height * 0.5) {
      rawIndex = index;
      break;
    }
  }

  let toIndex = rawIndex;
  if (toIndex > fromIndex) toIndex -= 1;

  return {
    rawIndex,
    toIndex: Math.max(0, Math.min(group.items.length - 1, toIndex)),
    fromIndex,
  };
}

function updateLayerSettingsDrawingDropIndicator(rawIndex, toIndex, fromIndex) {
  clearLayerSettingsDropIndicatorClasses(".layer-settings-drawing-group");

  if (!state.layerSettingsPointerDrag || !layerSettingsDrawingList || toIndex === -1 || fromIndex === -1 || toIndex === fromIndex) {
    return;
  }

  const groups = Array.from(layerSettingsDrawingList.querySelectorAll(".layer-settings-drawing-group"));
  if (!groups.length) return;

  if (rawIndex >= groups.length) {
    groups[groups.length - 1].classList.add("drag-insert-after");
    return;
  }

  groups[Math.max(0, rawIndex)].classList.add("drag-insert-before");
}

function updateLayerSettingsLayerDropIndicator(drawingId, rawIndex, toIndex, fromIndex) {
  clearLayerSettingsDropIndicatorClasses(".layer-settings-row");

  if (!state.layerSettingsPointerDrag || !layerSettingsDrawingList || toIndex === -1 || fromIndex === -1 || toIndex === fromIndex) {
    return;
  }

  const groupEl = layerSettingsDrawingList.querySelector(`.layer-settings-drawing-group[data-drawing-id="${drawingId}"]`);
  const rows = groupEl ? Array.from(groupEl.querySelectorAll(".layer-settings-row")) : [];
  if (!rows.length) return;

  if (rawIndex >= rows.length) {
    rows[rows.length - 1].classList.add("drag-insert-after");
    return;
  }

  rows[Math.max(0, rawIndex)].classList.add("drag-insert-before");
}

function clearLayerSettingsPointerDrag(commit = true) {
  const drag = state.layerSettingsPointerDrag;
  if (!drag) return;

  const draft = state.layerSettingsDraft;
  let shouldRerender = false;
  if (commit && draft) {
    const fromIndex = drag.fromIndex;
    const toIndex = Number.isInteger(drag.dropIndex) ? drag.dropIndex : fromIndex;
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      if (drag.type === "drawing") {
        draft.drawings = moveArrayItem(draft.drawings, fromIndex, toIndex);
      } else {
        draft.drawings = draft.drawings.map((group) =>
          group.drawingId === drag.drawingId
            ? {
                ...group,
                items: moveArrayItem(group.items, fromIndex, toIndex),
              }
            : group
        );
      }
      shouldRerender = true;
    }
  }

  if (drag.draggingEl) drag.draggingEl.classList.remove("dragging");
  clearLayerSettingsDropIndicatorClasses(".layer-settings-drawing-group");
  clearLayerSettingsDropIndicatorClasses(".layer-settings-row");
  if (layerSettingsModal) layerSettingsModal.classList.remove("drag-reordering");
  state.layerSettingsPointerDrag = null;
  if (shouldRerender) renderLayerSettingsModal();
}

function beginLayerSettingsPointerDrag(event, row, dragInfo) {
  if (!state.layerSettingsDraft || !row || !dragInfo) return;
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();
  clearLayerSettingsPointerDrag(false);

  const draggingEl = dragInfo.type === "drawing" ? row.closest(".layer-settings-drawing-group") || row : row;
  draggingEl.classList.add("dragging");
  if (layerSettingsModal) layerSettingsModal.classList.add("drag-reordering");

  const drop =
    dragInfo.type === "drawing"
      ? layerSettingsDrawingDropPosition(event.clientY, dragInfo.drawingId)
      : layerSettingsLayerDropPosition(event.clientY, dragInfo.layerId, dragInfo.drawingId);

  state.layerSettingsPointerDrag = {
    pointerId: event.pointerId,
    type: dragInfo.type,
    drawingId: dragInfo.drawingId,
    layerId: dragInfo.layerId,
    draggingEl,
    dropIndex: drop.toIndex,
    rawIndex: drop.rawIndex,
    fromIndex: drop.fromIndex,
  };
  if (dragInfo.type === "drawing") {
    updateLayerSettingsDrawingDropIndicator(drop.rawIndex, drop.toIndex, drop.fromIndex);
  } else {
    updateLayerSettingsLayerDropIndicator(dragInfo.drawingId, drop.rawIndex, drop.toIndex, drop.fromIndex);
  }
}

function renderLayerSettingsModal(options = {}) {
  if (!layerSettingsDrawingList || !layerSettingsEmptyState || !layerSettingsColumnHeadings) return;

  const draft = state.layerSettingsDraft;
  const displayUnitId = state.settings.displayUnit;
  const lengthStep = getLengthInputStep(displayUnitId);
  const preservedScrollTop =
    options.scrollTop !== undefined
      ? sanitizeLayerSettingsScrollTop(options.scrollTop)
      : layerSettingsBody
        ? sanitizeLayerSettingsScrollTop(layerSettingsBody.scrollTop)
        : sanitizeLayerSettingsScrollTop(state.layerSettingsUi?.scrollTop);

  layerSettingsDrawingList.innerHTML = "";
  layerSettingsColumnHeadings.classList.add("hidden");

  const drawings = Array.isArray(draft?.drawings) ? draft.drawings : [];
  layerSettingsEmptyState.classList.toggle("hidden", drawings.length > 0);
  if (!drawings.length) {
    if (layerSettingsBody) layerSettingsBody.scrollTop = 0;
    state.layerSettingsUi.scrollTop = 0;
    return;
  }
  layerSettingsColumnHeadings.classList.remove("hidden");

  const activeDrag = state.layerSettingsPointerDrag;
  for (const group of drawings) {
    const groupEl = document.createElement("section");
    groupEl.className = `layer-settings-drawing-group${group.collapsed ? " collapsed" : ""}`;
    groupEl.dataset.drawingId = group.drawingId;
    if (activeDrag && activeDrag.type === "drawing" && activeDrag.drawingId === group.drawingId) {
      groupEl.classList.add("dragging");
    }

    const header = document.createElement("div");
    header.className = "layer-settings-drawing-header";

    const headerGrip = document.createElement("div");
    headerGrip.className = "drag-handle";
    headerGrip.textContent = "⋮⋮";
    headerGrip.draggable = false;
    headerGrip.addEventListener("pointerdown", (event) => {
      beginLayerSettingsPointerDrag(event, groupEl, { type: "drawing", drawingId: group.drawingId });
    });
    header.appendChild(headerGrip);

    const headerMain = document.createElement("div");
    headerMain.className = "layer-settings-drawing-main";

    const toggleButton = document.createElement("button");
    toggleButton.className = "layer-settings-drawing-toggle";
    toggleButton.type = "button";
    toggleButton.textContent = "▼";
    toggleButton.setAttribute("aria-label", `${group.collapsed ? "Expand" : "Collapse"} ${group.name}`);
    toggleButton.addEventListener("click", () => {
      group.collapsed = !group.collapsed;
      syncLayerSettingsUiMemoryFromDraft();
      renderLayerSettingsModal({ scrollTop: state.layerSettingsUi.scrollTop });
    });
    headerMain.appendChild(toggleButton);

    const drawingName = document.createElement("div");
    drawingName.className = "layer-settings-drawing-name";
    drawingName.textContent = group.name;
    headerMain.appendChild(drawingName);
    header.appendChild(headerMain);

    const drawingHeightDisplay = document.createElement("input");
    drawingHeightDisplay.className = "layer-settings-summary-field";
    drawingHeightDisplay.type = "number";
    drawingHeightDisplay.readOnly = true;
    drawingHeightDisplay.setAttribute("aria-label", `${group.name} total height`);
    drawingHeightDisplay.step = lengthStep;

    const drawingStartField = document.createElement("div");
    drawingStartField.className = "layer-settings-field";
    const drawingStartInput = document.createElement("input");
    drawingStartInput.type = "number";
    drawingStartInput.step = lengthStep;
    drawingStartInput.setAttribute("aria-label", `${group.name} start elevation`);
    drawingStartField.appendChild(drawingStartInput);

    const drawingEndField = document.createElement("div");
    drawingEndField.className = "layer-settings-field";
    const drawingEndInput = document.createElement("input");
    drawingEndInput.type = "number";
    drawingEndInput.step = lengthStep;
    drawingEndInput.setAttribute("aria-label", `${group.name} end elevation`);
    drawingEndField.appendChild(drawingEndInput);

    const rowControllers = [];
    const syncGroupFields = () => {
      drawingHeightDisplay.value = formatLengthInputValue(getLayerSettingsGroupHeightMm(group), displayUnitId);
      drawingStartInput.value = formatLengthInputValue(getLayerSettingsGroupStartMm(group), displayUnitId);
      drawingEndInput.value = formatLengthInputValue(getLayerSettingsGroupEndMm(group), displayUnitId);
      rowControllers.forEach((controller) => controller.sync());
    };

    const shiftGroupStartByMm = (deltaMm) => {
      if (!Number.isFinite(deltaMm) || Math.abs(deltaMm) <= 1e-9) return;
      group.items.forEach((item) => {
        item.baseElevationMm = quantizeCoordinate(item.baseElevationMm + deltaMm);
      });
      syncGroupFields();
    };

    drawingStartInput.addEventListener("input", () => {
      const parsedStartMm = parseLayerSettingsLengthInput(drawingStartInput.value, displayUnitId);
      if (parsedStartMm === null) return;
      shiftGroupStartByMm(parsedStartMm - getLayerSettingsGroupStartMm(group));
    });
    const normalizeGroupStart = () => {
      const parsedStartMm = parseLayerSettingsLengthInput(drawingStartInput.value, displayUnitId);
      if (parsedStartMm !== null) {
        shiftGroupStartByMm(parsedStartMm - getLayerSettingsGroupStartMm(group));
      } else {
        syncGroupFields();
      }
    };
    drawingStartInput.addEventListener("change", normalizeGroupStart);
    drawingStartInput.addEventListener("blur", normalizeGroupStart);

    drawingEndInput.addEventListener("input", () => {
      const parsedEndMm = parseLayerSettingsLengthInput(drawingEndInput.value, displayUnitId);
      if (parsedEndMm === null) return;
      shiftGroupStartByMm(parsedEndMm - getLayerSettingsGroupEndMm(group));
    });
    const normalizeGroupEnd = () => {
      const parsedEndMm = parseLayerSettingsLengthInput(drawingEndInput.value, displayUnitId);
      if (parsedEndMm !== null) {
        shiftGroupStartByMm(parsedEndMm - getLayerSettingsGroupEndMm(group));
      } else {
        syncGroupFields();
      }
    };
    drawingEndInput.addEventListener("change", normalizeGroupEnd);
    drawingEndInput.addEventListener("blur", normalizeGroupEnd);

    header.appendChild(drawingHeightDisplay);
    header.appendChild(drawingStartField);
    header.appendChild(drawingEndField);
    groupEl.appendChild(header);

    const layerList = document.createElement("div");
    layerList.className = "layer-settings-drawing-layers";

    group.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "layer-settings-row";
      if (activeDrag && activeDrag.type === "layer" && activeDrag.layerId === item.layerId) {
        row.classList.add("dragging");
      }

      const rowGrip = document.createElement("div");
      rowGrip.className = "drag-handle";
      rowGrip.textContent = "⋮⋮";
      rowGrip.draggable = false;
      rowGrip.addEventListener("pointerdown", (event) => {
        beginLayerSettingsPointerDrag(event, row, { type: "layer", drawingId: group.drawingId, layerId: item.layerId });
      });
      row.appendChild(rowGrip);

      const nameCell = document.createElement("div");
      nameCell.className = "layer-settings-layer-name";

      const label = document.createElement("div");
      label.className = "layer-settings-layer-label";
      label.textContent = item.name;
      nameCell.appendChild(label);
      row.appendChild(nameCell);

      const heightField = document.createElement("div");
      heightField.className = "layer-settings-field";
      const heightInput = document.createElement("input");
      heightInput.type = "number";
      heightInput.step = lengthStep;
      heightInput.min = "0";
      heightInput.setAttribute("aria-label", `${item.name} height`);
      heightField.appendChild(heightInput);
      row.appendChild(heightField);

      const startField = document.createElement("div");
      startField.className = "layer-settings-field";
      const startInput = document.createElement("input");
      startInput.type = "number";
      startInput.step = lengthStep;
      startInput.setAttribute("aria-label", `${item.name} start elevation`);
      startField.appendChild(startInput);
      row.appendChild(startField);

      const endField = document.createElement("div");
      endField.className = "layer-settings-field";
      const endInput = document.createElement("input");
      endInput.type = "number";
      endInput.step = lengthStep;
      endInput.setAttribute("aria-label", `${item.name} end elevation`);
      endField.appendChild(endInput);
      row.appendChild(endField);

      const syncRowFields = () => {
        heightInput.value = formatLengthInputValue(item.heightMm, displayUnitId);
        startInput.value = formatLengthInputValue(item.baseElevationMm, displayUnitId);
        endInput.value = formatLengthInputValue(item.baseElevationMm + item.heightMm, displayUnitId);
      };

      heightInput.addEventListener("input", () => {
        const parsedHeightMm = parseLayerSettingsLengthInput(heightInput.value, displayUnitId);
        if (parsedHeightMm === null) return;
        item.heightMm = Math.max(0, parsedHeightMm);
        endInput.value = formatLengthInputValue(item.baseElevationMm + item.heightMm, displayUnitId);
        drawingHeightDisplay.value = formatLengthInputValue(getLayerSettingsGroupHeightMm(group), displayUnitId);
        drawingEndInput.value = formatLengthInputValue(getLayerSettingsGroupEndMm(group), displayUnitId);
      });
      const normalizeHeight = () => {
        const parsedHeightMm = parseLayerSettingsLengthInput(heightInput.value, displayUnitId);
        if (parsedHeightMm !== null) {
          item.heightMm = Math.max(0, parsedHeightMm);
        }
        syncGroupFields();
      };
      heightInput.addEventListener("change", normalizeHeight);
      heightInput.addEventListener("blur", normalizeHeight);

      startInput.addEventListener("input", () => {
        const parsedStartMm = parseLayerSettingsLengthInput(startInput.value, displayUnitId);
        if (parsedStartMm === null) return;
        item.baseElevationMm = parsedStartMm;
        endInput.value = formatLengthInputValue(item.baseElevationMm + item.heightMm, displayUnitId);
        drawingHeightDisplay.value = formatLengthInputValue(getLayerSettingsGroupHeightMm(group), displayUnitId);
        drawingStartInput.value = formatLengthInputValue(getLayerSettingsGroupStartMm(group), displayUnitId);
        drawingEndInput.value = formatLengthInputValue(getLayerSettingsGroupEndMm(group), displayUnitId);
      });
      const normalizeStart = () => {
        const parsedStartMm = parseLayerSettingsLengthInput(startInput.value, displayUnitId);
        if (parsedStartMm !== null) {
          item.baseElevationMm = parsedStartMm;
        }
        syncGroupFields();
      };
      startInput.addEventListener("change", normalizeStart);
      startInput.addEventListener("blur", normalizeStart);

      endInput.addEventListener("input", () => {
        const parsedEndMm = parseLayerSettingsLengthInput(endInput.value, displayUnitId);
        if (parsedEndMm === null) return;
        item.baseElevationMm = quantizeCoordinate(parsedEndMm - item.heightMm);
        startInput.value = formatLengthInputValue(item.baseElevationMm, displayUnitId);
        drawingHeightDisplay.value = formatLengthInputValue(getLayerSettingsGroupHeightMm(group), displayUnitId);
        drawingStartInput.value = formatLengthInputValue(getLayerSettingsGroupStartMm(group), displayUnitId);
        drawingEndInput.value = formatLengthInputValue(getLayerSettingsGroupEndMm(group), displayUnitId);
      });
      const normalizeEnd = () => {
        const parsedEndMm = parseLayerSettingsLengthInput(endInput.value, displayUnitId);
        if (parsedEndMm !== null) {
          item.baseElevationMm = quantizeCoordinate(parsedEndMm - item.heightMm);
        }
        syncGroupFields();
      };
      endInput.addEventListener("change", normalizeEnd);
      endInput.addEventListener("blur", normalizeEnd);

      rowControllers.push({ sync: syncRowFields });
      syncRowFields();
      layerList.appendChild(row);
    });

    syncGroupFields();
    groupEl.appendChild(layerList);
    layerSettingsDrawingList.appendChild(groupEl);
  }

  if (layerSettingsBody) {
    layerSettingsBody.scrollTop = preservedScrollTop;
  }
  state.layerSettingsUi.scrollTop = preservedScrollTop;
}

function applyLayerSettingsDraft() {
  if (!state.layerSettingsDraft) return;

  syncLayerSettingsUiMemoryFromDraft();

  const visualDrawingIds = (state.layerSettingsDraft.drawings || []).map((drawing) => drawing.drawingId);
  if (visualDrawingIds.length) {
    reorderDrawingsFromVisualOrder(visualDrawingIds);
  }

  for (const drawing of state.layerSettingsDraft.drawings || []) {
    const visualLayerIds = (drawing.items || []).map((item) => item.layerId);
    if (visualLayerIds.length) {
      reorderLayersForDrawingFromVisualOrder(drawing.drawingId, visualLayerIds);
    }
  }

  const layerDrafts = new Map();
  for (const drawing of state.layerSettingsDraft.drawings || []) {
    for (const item of drawing.items || []) {
      layerDrafts.set(item.layerId, {
        baseElevationMm: quantizeCoordinate(item.baseElevationMm),
        heightMm: Math.max(0, quantizeCoordinate(item.heightMm)),
      });
    }
  }

  state.layers = state.layers.map((layer) => {
    const layerDraft = layerDrafts.get(layer.id);
    if (!layerDraft) return layer;
    return {
      ...layer,
      render: {
        ...cloneLayerRenderSettings(layer.render),
        baseElevationMm: layerDraft.baseElevationMm,
        heightMm: layerDraft.heightMm,
      },
    };
  });

  renderLayersPanel();
  render();
  syncTrackedRenderPopout("layer-settings-apply");
}

function isAnyModalOpen() {
  return (
    (!!settingsMenu && !settingsMenu.classList.contains("hidden")) ||
    (!!exportFallbackMenu && !exportFallbackMenu.classList.contains("hidden")) ||
    (!!layerSettingsModal && !layerSettingsModal.classList.contains("hidden")) ||
    (!!renderBoxPropertiesModal && !renderBoxPropertiesModal.classList.contains("hidden")) ||
    (!!renderSettingsModal && !renderSettingsModal.classList.contains("hidden"))
  );
}

function syncModalBackdropVisibility() {
  if (!modalBackdrop) return;
  modalBackdrop.classList.toggle("hidden", !isAnyModalOpen());
}

function openSettingsMenu() {
  if (!settingsMenu) return;

  closeExportFallbackMenu();
  closeLayerSettingsModal();
  closeRenderBoxPropertiesModal();
  closeRenderSettingsMenu();
  state.settingsDraft = cloneSettings(state.settings);
  syncSettingsMenu();
  settingsMenu.classList.remove("hidden");
  syncModalBackdropVisibility();
}

function closeSettingsMenu() {
  if (!settingsMenu) return;

  settingsMenu.classList.add("hidden");
  state.settingsDraft = null;
  syncModalBackdropVisibility();
}

function openExportFallbackMenu() {
  if (!exportFallbackMenu) return;
  closeSettingsMenu();
  closeLayerSettingsModal();
  closeRenderBoxPropertiesModal();
  closeRenderSettingsMenu();
  exportFallbackMenu.classList.remove("hidden");
  syncModalBackdropVisibility();
}

function closeExportFallbackMenu() {
  if (!exportFallbackMenu) return;
  exportFallbackMenu.classList.add("hidden");
  syncModalBackdropVisibility();
}

function openLayerSettingsModal() {
  if (!layerSettingsModal) return;

  closeSettingsMenu();
  closeExportFallbackMenu();
  closeRenderBoxPropertiesModal();
  closeRenderSettingsMenu();
  state.layerSettingsDraft = createLayerSettingsDraft();
  layerSettingsModal.classList.remove("hidden");
  renderLayerSettingsModal({ scrollTop: state.layerSettingsUi.scrollTop });
  if (layerSettingsBody) {
    layerSettingsBody.scrollTop = sanitizeLayerSettingsScrollTop(state.layerSettingsUi.scrollTop);
  }
  syncModalBackdropVisibility();
}

function closeLayerSettingsModal() {
  clearLayerSettingsPointerDrag(false);
  if (!layerSettingsModal) return;
  syncLayerSettingsUiMemoryFromDraft();
  layerSettingsModal.classList.add("hidden");
  state.layerSettingsDraft = null;
  syncModalBackdropVisibility();
}

function openRenderSettingsMenu() {
  if (!renderSettingsModal) return;

  closeSettingsMenu();
  closeExportFallbackMenu();
  closeLayerSettingsModal();
  closeRenderBoxPropertiesModal();
  state.renderSettingsDraft = cloneRenderSettings(state.renderSettings);
  syncRenderSettingsMenu();
  renderSettingsModal.classList.remove("hidden");
  syncModalBackdropVisibility();
}

function closeRenderSettingsMenu() {
  if (!renderSettingsModal) return;

  renderSettingsModal.classList.add("hidden");
  state.renderSettingsDraft = null;
  syncModalBackdropVisibility();
}

function openRenderBoxPropertiesModal(renderId) {
  if (!renderBoxPropertiesModal) return;

  const draft = createRenderBoxPropertiesDraft(renderId);
  if (!draft) return;

  closeSettingsMenu();
  closeExportFallbackMenu();
  closeLayerSettingsModal();
  closeRenderSettingsMenu();
  state.renderBoxPropertiesDraft = draft;
  syncRenderBoxPropertiesModal();
  renderBoxPropertiesModal.classList.remove("hidden");
  syncModalBackdropVisibility();
}

function closeRenderBoxPropertiesModal() {
  if (!renderBoxPropertiesModal) return;

  renderBoxPropertiesModal.classList.add("hidden");
  state.renderBoxPropertiesDraft = null;
  syncModalBackdropVisibility();
}

function applyRenderBoxPropertiesDraft() {
  const draft = state.renderBoxPropertiesDraft;
  if (!draft) return;

  const renderRecord = getRenderById(draft.renderId);
  if (!renderRecord) return;

  renderRecord.volume = cloneRenderVolumeSettings({
    baseElevationMm: draft.baseElevationMm,
    heightMm: draft.heightMm,
  });
  state.renderBoxPropertiesDraft = createRenderBoxPropertiesDraft(renderRecord.id);
  syncRenderBoxPropertiesModal();
  renderLayersPanel();
  renderWorkspaceUi();
  render();
  syncTrackedRenderPopout("rbox-properties-apply");
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

function applyRenderSettingsDraft() {
  if (!state.renderSettingsDraft) return;

  if (renderDepthStrengthValue && renderDepthStrengthValue.value.trim() !== "") {
    state.renderSettingsDraft.depthEffect.strength = sanitizeRenderDepthStrength(
      renderDepthStrengthValue.value,
      state.renderSettingsDraft.depthEffect.strength
    );
  }

  if (renderOutlineColorInput) {
    state.renderSettingsDraft.outlineEffect.color = sanitizeColorValue(
      renderOutlineColorInput.value,
      state.renderSettingsDraft.outlineEffect.color
    );
  }

  if (renderOutlineWidthInput) {
    state.renderSettingsDraft.outlineEffect.thickness = sanitizeRenderOutlineThickness(
      renderOutlineWidthInput.value,
      state.renderSettingsDraft.outlineEffect.thickness
    );
  }

  state.renderSettings = cloneRenderSettings(state.renderSettingsDraft);
  state.renderSettingsDraft = cloneRenderSettings(state.renderSettings);
  syncRenderSettingsMenu();
  renderWorkspaceUi();
  render();
  syncTrackedRenderPopout("render-settings-apply");
}

function updateCursor() {
  if (state.renderTransformDrag) {
    canvas.style.cursor = "move";
    return;
  }

  if (state.activeRenderId) {
    const activeRender = getSelectedRenderRecord();
    const hit = activeRender ? getRenderTransformHit(activeRender, state.current) : null;
    canvas.style.cursor = hit ? "move" : "default";
    return;
  }

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
    render: cloneLayerRenderSettings(options.render),
  };
}

function createDrawingWithDefaultLayer(name = "Drawing " + state.nextDrawingId) {
  const drawing = createDrawingUiRecord(name);
  const layer = createLayerRecord(drawing.id);
  return { drawing, layer };
}

function getRenderById(id) {
  return state.renders.find((render) => render.id === id) || null;
}

function createRenderRecord(options = {}) {
  const id = "render-" + state.nextRenderId;
  const fallbackName = "Rbox " + state.nextRenderId;
  state.nextRenderId += 1;
  const layoutPreset = cloneRenderLayoutPreset(options.layoutPreset);
  const paneDirectionProfiles = cloneRenderPaneDirectionProfiles(options.paneDirectionProfiles);
  return {
    id,
    name: typeof options.name === "string" && options.name.trim() ? options.name.trim() : fallbackName,
    visible: options.visible !== false,
    layoutPreset,
    paneDirectionProfiles,
    syncFit: cloneRenderSyncFit(options.syncFit),
    boxGeometry: cloneRenderBoxGeometry(options.boxGeometry),
    volume: cloneRenderVolumeSettings(options.volume),
    sectionSettings: cloneRenderSectionSettings(options.sectionSettings),
  };
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

function getLayerArea(layerId) {
  return state.shapes
    .filter((shape) => shape.layerId === layerId)
    .reduce((total, shape) => total + getGeometryArea(shape.geometry), 0);
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

function getDrawingCardElement(drawingId) {
  return layersList.querySelector(`.drawing-card[data-drawing-id="${drawingId}"]`);
}

function getLayerCardElements() {
  return Array.from(layersList.querySelectorAll(".layer-card"));
}

function getLayerCardElement(layerId) {
  return layersList.querySelector(`.layer-card[data-layer-id="${layerId}"]`);
}

function getRenderCardElements() {
  return rendersList ? Array.from(rendersList.querySelectorAll(".render-card")) : [];
}

function getRenderCardElement(renderId) {
  return rendersList ? rendersList.querySelector(`.render-card[data-render-id="${renderId}"]`) : null;
}

function isClientPointInsideRect(clientX, clientY, rect) {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function getLayerTransferTargetDrawingId(clientX, clientY, sourceDrawingId) {
  for (const card of getDrawingCardElements()) {
    const drawingId = card.dataset.drawingId;
    if (!drawingId || drawingId === sourceDrawingId) continue;
    if (isClientPointInsideRect(clientX, clientY, card.getBoundingClientRect())) return drawingId;
  }

  return null;
}

function getLayerMergeTargetLayerId(clientX, clientY, sourceLayerId) {
  const sourceLayer = getLayerById(sourceLayerId);
  if (!sourceLayer || sourceLayer.locked) return null;

  for (const card of getLayerCardElements()) {
    const layerId = card.dataset.layerId;
    if (!layerId || layerId === sourceLayerId) continue;

    const layer = getLayerById(layerId);
    if (!layer || layer.locked) continue;

    const rect = card.getBoundingClientRect();
    if (!isClientPointInsideRect(clientX, clientY, rect)) continue;

    const mergeEdgeInset = Math.max(10, Math.min(24, rect.height * 0.28));
    if (clientY <= rect.top + mergeEdgeInset || clientY >= rect.bottom - mergeEdgeInset) continue;

    return layerId;
  }

  return null;
}

function clearLeftPanelDropIndicatorClasses(listEl = null) {
  const root = listEl || layersList;
  root.querySelectorAll(".drag-insert-before, .drag-insert-after").forEach((element) => {
    element.classList.remove("drag-insert-before");
    element.classList.remove("drag-insert-after");
  });
}

function clearLayerTransferTargetClasses(root = layersList) {
  root.querySelectorAll(".layer-drop-target").forEach((element) => {
    element.classList.remove("layer-drop-target");
  });
}

function updateLayerTransferTargetIndicator(targetDrawingId) {
  clearLayerTransferTargetClasses(layersList);
  if (!state.leftPanelPointerDrag || !targetDrawingId) return;

  const card = getDrawingCardElement(targetDrawingId);
  if (card) card.classList.add("layer-drop-target");
}

function clearLayerMergeTargetClasses(root = layersList) {
  root.querySelectorAll(".layer-merge-target").forEach((element) => {
    element.classList.remove("layer-merge-target");
  });
}

function updateLayerMergeTargetIndicator(targetLayerId) {
  clearLayerMergeTargetClasses(layersList);
  if (!state.leftPanelPointerDrag || !targetLayerId) return;

  const card = getLayerCardElement(targetLayerId);
  if (card) card.classList.add("layer-merge-target");
}

function reorderDrawingsFromVisualOrder(visualDrawingIds) {
  const reordered = visualDrawingIds.map((drawingId) => getDrawingUiById(drawingId)).filter(Boolean);
  if (reordered.length !== state.drawingsUi.length) return;
  state.drawingsUi = reordered;
}

function reorderRendersFromVisualOrder(visualRenderIds) {
  const reordered = visualRenderIds.map((renderId) => getRenderById(renderId)).filter(Boolean);
  if (reordered.length !== state.renders.length) return;
  state.renders = reordered;
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

function renderDropPositionFromClientY(clientY, sourceRenderId) {
  const items = state.renders;
  if (!items.length) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const fromIndex = items.findIndex((render) => render.id === sourceRenderId);
  if (fromIndex === -1) return { rawIndex: -1, toIndex: -1, fromIndex: -1 };

  const cards = getRenderCardElements();
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

function updateRenderDropIndicator(rawIndex, toIndex, fromIndex) {
  clearLeftPanelDropIndicatorClasses(rendersList);

  if (!state.leftPanelPointerDrag || toIndex === -1 || fromIndex === -1 || toIndex === fromIndex) return;

  const cards = getRenderCardElements();
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
  } else if (drag.type === "render") {
    clearLeftPanelDropIndicatorClasses(rendersList);
  } else {
    clearLeftPanelDropIndicatorClasses(getLayerListElementForDrawing(drag.drawingId));
  }
  clearLayerTransferTargetClasses(layersList);
  clearLayerMergeTargetClasses(layersList);
  if (layersPanel) layersPanel.classList.remove("drag-reordering");

  state.leftPanelPointerDrag = null;

  if (commit && drag.type === "layer" && drag.targetMode === "merge" && drag.targetLayerId) {
    if (mergeLayerIntoTarget(drag.layerId, drag.targetLayerId)) {
      renderLayersPanel();
      render();
      syncTrackedRenderPopout("merge-layer");
      return;
    }
  }

  if (commit && drag.type === "layer" && drag.targetMode === "drawing" && drag.targetDrawingId) {
    if (moveLayerToDrawingTop(drag.layerId, drag.targetDrawingId)) {
      renderLayersPanel();
      render();
      syncTrackedRenderPopout("move-layer-to-drawing");
      return;
    }
  }

  if (commit && drag.fromIndex !== -1 && drag.dropIndex !== -1 && drag.dropIndex !== drag.fromIndex) {
    if (drag.type === "drawing") {
      const currentVisualDrawings = state.drawingsUi.map((drawing) => drawing.id);
      const nextVisualDrawings = moveArrayItem(currentVisualDrawings, drag.fromIndex, drag.dropIndex);
      reorderDrawingsFromVisualOrder(nextVisualDrawings);
    } else if (drag.type === "render") {
      const currentVisualRenders = state.renders.map((render) => render.id);
      const nextVisualRenders = moveArrayItem(currentVisualRenders, drag.fromIndex, drag.dropIndex);
      reorderRendersFromVisualOrder(nextVisualRenders);
    } else {
      const currentVisualLayers = getLayersForDrawing(drag.drawingId).map((layer) => layer.id);
      const nextVisualLayers = moveArrayItem(currentVisualLayers, drag.fromIndex, drag.dropIndex);
      reorderLayersForDrawingFromVisualOrder(drag.drawingId, nextVisualLayers);
    }
    renderLayersPanel();
    render();
    syncTrackedRenderPopout(`reorder-${drag.type}`);
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

function beginRenderPointerDrag(event, card, renderId) {
  if (!card || !renderId || !rendersList) return;
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();
  clearLeftPanelPointerDrag(false);

  card.classList.add("dragging");
  if (layersPanel) layersPanel.classList.add("drag-reordering");

  const drop = renderDropPositionFromClientY(event.clientY, renderId);
  state.leftPanelPointerDrag = {
    type: "render",
    pointerId: event.pointerId,
    renderId,
    sourceCard: card,
    dropIndex: drop.toIndex,
    rawIndex: drop.rawIndex,
    fromIndex: drop.fromIndex,
  };

  updateRenderDropIndicator(drop.rawIndex, drop.toIndex, drop.fromIndex);
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
    targetDrawingId: null,
    targetLayerId: null,
    targetMode: "reorder",
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

function openLayerFillPicker(layerId, drawingId = getLayerDrawingId(getLayerById(layerId))) {
  const layer = getLayerById(layerId);
  if (!layer || !layerFillInput) return;

  setActiveDrawingById(drawingId, { layerId });
  renderLayersPanel();
  render();
  syncActiveLayerControls();

  try {
    if (typeof layerFillInput.showPicker === "function") {
      layerFillInput.showPicker();
      return;
    }
  } catch {}

  layerFillInput.click();
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

function beginRenameRender(renderId) {
  const renderRecord = getRenderById(renderId);
  if (!renderRecord) return;
  state.editingRenderId = renderId;
  state.editingRenderInitialName = renderRecord.name;
  state.editingRenderNameDraft = renderRecord.name;
  renderLayersPanel();
}

function endRenameRender(commit = true) {
  const renderRecord = getRenderById(state.editingRenderId);
  if (commit && renderRecord) {
    const nextName = String(state.editingRenderNameDraft || "").trim();
    renderRecord.name = nextName || state.editingRenderInitialName || renderRecord.name;
  }

  state.editingRenderId = null;
  state.editingRenderNameDraft = "";
  state.editingRenderInitialName = "";
  renderLayersPanel();
  renderWorkspaceUi();
  if (commit && renderRecord) {
    syncTrackedRenderPopout("rename-rbox");
  }
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

function isRenderBoxShapeType(shapeType = state.shapeType) {
  return shapeType === "rbox";
}

function isEllipseShapeType(shapeType = state.shapeType) {
  return shapeType === "ellipse";
}

function isBoxSnapShapeType(shapeType = state.shapeType) {
  return isRectangleShapeType(shapeType) || isRenderBoxShapeType(shapeType) || isEllipseShapeType(shapeType);
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

  if (!state.squareBrushLockedAxis) {
    return cloneDraftPoint(state.squareBrushLockAnchorDraft) || snapDraftPointToSquareBrushCenter(point);
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

function deepCopyVertexOutlineEligibility(vertexOutlineEligibility) {
  return Array.isArray(vertexOutlineEligibility)
    ? vertexOutlineEligibility.map((polygon) =>
        Array.isArray(polygon) ? polygon.map((ring) => (Array.isArray(ring) ? ring.map((value) => value !== false) : [])) : []
      )
    : [];
}

function createUniformVertexOutlineEligibility(geometry, outlineEligible = true) {
  return geometry.map((polygon) => polygon.map((ring) => ring.map(() => outlineEligible !== false)));
}

function normalizeVertexOutlineEligibility(geometry, vertexOutlineEligibility = null, fallback = true) {
  return geometry.map((polygon, polygonIndex) =>
    polygon.map((ring, ringIndex) =>
      ring.map((_, pointIndex) => {
        const value = vertexOutlineEligibility?.[polygonIndex]?.[ringIndex]?.[pointIndex];
        if (value === false) return false;
        if (value === true) return true;
        return fallback !== false;
      })
    )
  );
}

function getVertexOutlineEligibilityAt(vertexOutlineEligibility, polygonIndex, ringIndex, pointIndex, fallback = true) {
  const value = vertexOutlineEligibility?.[polygonIndex]?.[ringIndex]?.[pointIndex];
  if (value === false) return false;
  if (value === true) return true;
  return fallback !== false;
}

function getOutlineVertexKey(point) {
  return `${scaleCoordinateToClipperInt(point[0])}:${scaleCoordinateToClipperInt(point[1])}`;
}

function collectIneligibleVertexKeys(sourceShapeRecords = []) {
  const keys = new Set();
  if (!Array.isArray(sourceShapeRecords)) return keys;

  sourceShapeRecords.forEach((shapeRecord) => {
    if (!shapeRecord?.geometry) return;
    forEachRing(shapeRecord.geometry, (ring, polygonIndex, ringIndex) => {
      ring.forEach((point, pointIndex) => {
        if (getVertexOutlineEligibilityAt(shapeRecord.vertexOutlineEligibility, polygonIndex, ringIndex, pointIndex, true)) return;
        keys.add(getOutlineVertexKey(point));
      });
    });
  });

  return keys;
}

function createVertexOutlineEligibilityFromSources(geometry, sourceShapeRecords = null, fallback = true) {
  if (!Array.isArray(sourceShapeRecords) || !sourceShapeRecords.length) {
    return createUniformVertexOutlineEligibility(geometry, fallback);
  }

  const ineligibleKeys = collectIneligibleVertexKeys(sourceShapeRecords);
  if (!ineligibleKeys.size) return createUniformVertexOutlineEligibility(geometry, fallback);

  return geometry.map((polygon) =>
    polygon.map((ring) => ring.map((point) => !ineligibleKeys.has(getOutlineVertexKey(point))))
  );
}

function getDefaultOutlineEligibilityForShapeType(shapeType = state.shapeType) {
  return shapeType !== "ellipse";
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

function getRingArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    area += current[0] * next[1] - next[0] * current[1];
  }

  return area / 2;
}

function getPolygonArea(polygon) {
  if (!Array.isArray(polygon) || !polygon.length) return 0;

  let area = Math.abs(getRingArea(polygon[0]));
  for (let ringIndex = 1; ringIndex < polygon.length; ringIndex += 1) {
    area -= Math.abs(getRingArea(polygon[ringIndex]));
  }

  return Math.max(0, area);
}

function getGeometryArea(geometry) {
  if (!Array.isArray(geometry)) return 0;
  return geometry.reduce((total, polygon) => total + getPolygonArea(polygon), 0);
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

function drawGeometryVertices(
  targetCtx,
  geometry,
  radius = vertexMarkerRadiusPx / state.camera.zoom,
  vertexOutlineEligibility = null,
  eligibilityFilter = null
) {
  forEachRing(geometry, (ring, polygonIndex, ringIndex) => {
    for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 1) {
      const point = ring[pointIndex];
      const outlineEligible = getVertexOutlineEligibilityAt(
        vertexOutlineEligibility,
        polygonIndex,
        ringIndex,
        pointIndex,
        true
      );
      if (eligibilityFilter !== null && outlineEligible !== eligibilityFilter) continue;
      targetCtx.moveTo(point[0] + radius, point[1]);
      targetCtx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    }
  });
}

function createShapeRecord(layerId, geometry, id = null, options = {}) {
  const cleanGeometry = sanitizeGeometry(geometry);
  if (!cleanGeometry.length) return null;
  const defaultOutlineEligible = options.defaultOutlineEligible !== false;

  return {
    id: id || "shape-" + state.nextShapeId++,
    layerId,
    geometry: cleanGeometry,
    bounds: getGeometryBounds(cleanGeometry),
    vertexOutlineEligibility: normalizeVertexOutlineEligibility(
      cleanGeometry,
      options.vertexOutlineEligibility,
      defaultOutlineEligible
    ),
  };
}

function cloneShape(shape) {
  return {
    id: shape.id,
    layerId: shape.layerId,
    geometry: deepCopyGeometry(shape.geometry),
    bounds: { ...shape.bounds },
    vertexOutlineEligibility: deepCopyVertexOutlineEligibility(shape.vertexOutlineEligibility),
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
  const half = Math.max(minDrawableDraftExtent / 2, width / 2);

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

function setDraftShapeFromGeometry(geometry, options = {}) {
  const cleanGeometry = sanitizeGeometry(geometry);
  state.draftShape = {
    geometry: cleanGeometry,
    bounds: getGeometryBounds(cleanGeometry),
    small: !cleanGeometry.length,
    vertexOutlineEligibility: normalizeVertexOutlineEligibility(
      cleanGeometry,
      options.vertexOutlineEligibility,
      options.defaultOutlineEligible !== false
    ),
  };
}

function resetDrawSession() {
  state.draftShape = null;
  state.pendingRenderBox = null;
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
  setDraftShapeFromGeometry(draftGeometryToWorld(draftGeometry), { defaultOutlineEligible: true });
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
      small: strip.length <= minDrawableDraftExtent,
      vertexOutlineEligibility: createUniformVertexOutlineEligibility(geometry, true),
    };
  }

  const rect = normalizeRect(start, end);
  const isEllipse = state.shapeType === "ellipse";
  const draftGeometry = isEllipse ? createEllipseGeometry(rect) : createRectGeometry(rect);
  const geometry = draftGeometryToWorld(draftGeometry);
  return {
    geometry,
    bounds: getGeometryBounds(geometry),
    small: rect.w <= minDrawableDraftExtent || rect.h <= minDrawableDraftExtent,
    vertexOutlineEligibility: createUniformVertexOutlineEligibility(geometry, !isEllipse),
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

function createLayerShapeRecordsFromSourceGeometry(layerId, geometry, sourceShapeRecords = null, fallback = true) {
  const multipolygon = sanitizeGeometry(geometry);
  const nextShapes = [];

  for (const polygon of multipolygon) {
    const polygonGeometry = [polygon];
    const shape = createShapeRecord(layerId, polygonGeometry, null, {
      vertexOutlineEligibility: createVertexOutlineEligibilityFromSources(polygonGeometry, sourceShapeRecords, fallback),
      defaultOutlineEligible: fallback,
    });
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
  return createLayerShapeRecordsFromSourceGeometry(layerId, simplifiedGeometry, sourceShapes, true);
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

function subtractGeometryFromLayer(layerId, subtractionGeometry, subtractionVertexOutlineEligibility = null) {
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layerId);
  if (!layerShapes.length) return;

  const affectsSelection = getSelectedShapes().some((shape) => shape.layerId === layerId);
  const nextGeometry = differenceGeometry(
    unionGeometryList(layerShapes.map((shape) => shape.geometry)),
    subtractionGeometry
  );
  const simplifiedGeometry = simplifyGeometryCollinear(nextGeometry);
  const subtractionSourceGeometry = sanitizeGeometry(subtractionGeometry);
  const subtractionSourceShapes = subtractionSourceGeometry.length
    ? [
        {
          geometry: subtractionSourceGeometry,
          vertexOutlineEligibility: normalizeVertexOutlineEligibility(
            subtractionSourceGeometry,
            subtractionVertexOutlineEligibility,
            true
          ),
        },
      ]
    : [];

  replaceLayerShapes(
    layerId,
    createLayerShapeRecordsFromSourceGeometry(layerId, simplifiedGeometry, [...layerShapes, ...subtractionSourceShapes], true)
  );

  if (affectsSelection) clearSelectionForLayer(layerId);
}

function renderLayersPanel() {
  layersList.innerHTML = "";
  if (rendersList) rendersList.innerHTML = "";
  const primaryDrawing = getPrimaryDrawingUi();
  if (primaryDrawing && !state.activeDrawingId) {
    setActiveDrawingById(primaryDrawing.id);
  }

  if (layerSection && layerSectionToggle) {
    layerSection.classList.toggle("collapsed", state.layerSectionCollapsed);
    layerSectionToggle.setAttribute("aria-expanded", String(!state.layerSectionCollapsed));
  }

  if (renderSection && renderSectionToggle) {
    renderSection.classList.toggle("collapsed", state.renderSectionCollapsed);
    renderSectionToggle.setAttribute("aria-expanded", String(!state.renderSectionCollapsed));
  }

  for (const drawing of state.drawingsUi) {
    const isExpanded = state.activeDrawingId === drawing.id;
    const drawingCard = document.createElement("div");
    drawingCard.className = "drawing-card" + (isExpanded ? " active-drawing" : " inactive-drawing");
    drawingCard.dataset.drawingId = drawing.id;

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
      card.dataset.layerId = layer.id;
      card.dataset.drawingId = drawing.id;
      if (!isActive) card.classList.add("inactive-collapsed");
      card.addEventListener("click", () => {
        setActiveDrawingById(drawing.id, { layerId: layer.id });
        renderLayersPanel();
        render();
      });

      const grip = document.createElement("div");
      grip.className = "drag-handle";
      grip.textContent = "⋮⋮";
      grip.title = "Layer handle";
      grip.addEventListener("click", (event) => event.stopPropagation());
      grip.addEventListener("pointerdown", (event) => {
        beginLayerPointerDrag(event, card, drawing.id, layer.id);
      });

      const colorSwatch = document.createElement("div");
      colorSwatch.className = "layer-color-swatch";
      colorSwatch.title = "Layer fill color";
      colorSwatch.style.setProperty("--layer-swatch-color", layer.fillColor);
      colorSwatch.addEventListener("pointerdown", (event) => event.stopPropagation());
      colorSwatch.addEventListener("mousedown", (event) => event.stopPropagation());
      colorSwatch.addEventListener("click", (event) => event.stopPropagation());

      const colorSwatchInput = document.createElement("input");
      colorSwatchInput.className = "layer-color-swatch-input";
      colorSwatchInput.type = "color";
      colorSwatchInput.value = layer.fillColor;
      colorSwatchInput.title = "Layer fill color";
      colorSwatchInput.setAttribute("aria-label", `Set fill color for ${layer.name}`);
      colorSwatchInput.addEventListener("pointerdown", (event) => event.stopPropagation());
      colorSwatchInput.addEventListener("mousedown", (event) => event.stopPropagation());
      colorSwatchInput.addEventListener("click", (event) => event.stopPropagation());
      colorSwatchInput.addEventListener("input", (event) => {
        layer.fillColor = event.target.value;
        colorSwatch.style.setProperty("--layer-swatch-color", layer.fillColor);
        render();
      });
      colorSwatchInput.addEventListener("change", () => {
        syncTrackedRenderPopout("layer-color-change");
      });
      colorSwatch.appendChild(colorSwatchInput);

      const main = document.createElement("div");
      main.className = "layer-main";

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
        syncTrackedRenderPopout("toggle-layer-visibility");
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

      const areaMeta = document.createElement("div");
      areaMeta.className = "layer-meta layer-card-detail";
      areaMeta.textContent = `Area ${formatAreaWithUnit(getLayerArea(layer.id), state.settings.displayUnit)}`;

      const meta = document.createElement("div");
      meta.className = "layer-meta layer-card-detail";
      meta.textContent = getLayerShapeCount(layer.id) + " objects";

      if (layer.locked) {
        const secondaryMeta = document.createElement("div");
        secondaryMeta.className = "layer-meta-secondary layer-card-detail";
        secondaryMeta.textContent = "Locked layer";
        card.appendChild(secondaryMeta);
      }

      const opacityField = document.createElement("div");
      opacityField.className = "field layer-card-detail layer-card-opacity-field";
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
      opacitySlider.addEventListener("change", () => {
        syncTrackedRenderPopout("layer-opacity-change");
      });

      opacityField.appendChild(opacityLabel);
      opacityField.appendChild(opacitySlider);

      card.appendChild(grip);
      card.appendChild(colorSwatch);
      card.appendChild(main);
      card.appendChild(areaMeta);
      card.appendChild(meta);
      card.appendChild(opacityField);
      drawingLayersList.appendChild(card);
    }

    layersSectionEl.appendChild(drawingLayersList);
    children.appendChild(layersSectionEl);
    drawingCard.appendChild(drawingMain);
    drawingCard.appendChild(children);
    layersList.appendChild(drawingCard);
  }

  if (rendersList) {
    if (!state.renders.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "render-empty-state";
      emptyState.textContent = "No Rboxes yet.";
      rendersList.appendChild(emptyState);
    } else {
      state.renders.forEach((renderRecord, index) => {
        const isActive = state.activeRenderId === renderRecord.id;
        const card = document.createElement("div");
        card.className = "render-card" + (isActive ? " active-render" : " inactive-render");
        card.dataset.renderId = renderRecord.id;
        card.addEventListener("click", () => {
          activateRenderBox(renderRecord.id);
        });

        const grip = document.createElement("div");
        grip.className = "drag-handle";
        grip.textContent = "⋮⋮";
        grip.title = "Render handle";
        grip.addEventListener("click", (event) => event.stopPropagation());
        grip.addEventListener("pointerdown", (event) => {
          beginRenderPointerDrag(event, card, renderRecord.id);
        });

        const main = document.createElement("div");
        main.className = "render-main";

        const header = document.createElement("div");
        header.className = "card-header";

        const titleWrap = document.createElement("div");
        titleWrap.className = "card-header-title";

        let nameField;
        if (state.editingRenderId === renderRecord.id) {
          const input = document.createElement("input");
          input.className = "layer-name";
          input.value = state.editingRenderNameDraft || renderRecord.name;
          input.size = Math.max(1, input.value.length);
          input.addEventListener("click", (event) => event.stopPropagation());
          input.addEventListener("pointerdown", (event) => event.stopPropagation());
          input.addEventListener("input", () => {
            state.editingRenderNameDraft = input.value;
            input.size = Math.max(1, input.value.length);
          });
          input.addEventListener("blur", endRenameRender);
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
              endRenameRender(false);
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
          label.textContent = getRenderTabLabel(renderRecord, index);
          label.addEventListener("click", (event) => {
            if (!isActive) return;
            event.stopPropagation();
            beginRenameRender(renderRecord.id);
          });
          nameField = label;
        }
        titleWrap.appendChild(nameField);

        const inlineControls = document.createElement("div");
        inlineControls.className = "inline-controls";

        const duplicateInline = document.createElement("button");
        duplicateInline.className = "inline-icon";
        duplicateInline.type = "button";
        duplicateInline.title = "Duplicate render";
        duplicateInline.appendChild(createInlineIcon("duplicate"));
        duplicateInline.addEventListener("click", (event) => {
          event.stopPropagation();
          duplicateRender(renderRecord.id);
        });
        inlineControls.appendChild(duplicateInline);

        const visibilityInline = document.createElement("button");
        visibilityInline.className = "inline-icon visibility-dot";
        visibilityInline.type = "button";
        visibilityInline.title = renderRecord.visible === false ? "Show render box" : "Hide render box";
        visibilityInline.appendChild(createInlineIcon("visibility", { filled: renderRecord.visible !== false }));
        visibilityInline.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleRenderVisibility(renderRecord.id);
        });
        inlineControls.appendChild(visibilityInline);

        const removeInline = document.createElement("button");
        removeInline.className = "inline-icon delete-mark";
        removeInline.type = "button";
        removeInline.title = "Delete render";
        removeInline.appendChild(createInlineIcon("delete"));
        removeInline.addEventListener("click", (event) => {
          event.stopPropagation();
          deleteRenderById(renderRecord.id);
        });
        inlineControls.appendChild(removeInline);

        header.appendChild(titleWrap);
        header.appendChild(inlineControls);
        main.appendChild(header);

        const children = document.createElement("div");
        children.className = "render-children";
        children.addEventListener("click", (event) => event.stopPropagation());

        const meta = document.createElement("div");
        meta.className = "render-card-meta";
        meta.textContent = getRenderBoxSummary(renderRecord);

        const secondaryMeta = document.createElement("div");
        secondaryMeta.className = "render-card-meta-secondary";
        secondaryMeta.textContent = getRenderSectionSummary(renderRecord);

        const propertiesButton = document.createElement("button");
        propertiesButton.className = "render-card-action-button";
        propertiesButton.type = "button";
        propertiesButton.textContent = "Rbox Properties";
        propertiesButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openRenderBoxPropertiesModal(renderRecord.id);
        });

        children.appendChild(meta);
        children.appendChild(secondaryMeta);
        children.appendChild(propertiesButton);

        card.appendChild(grip);
        card.appendChild(main);
        card.appendChild(children);
        rendersList.appendChild(card);
      });
    }
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
  syncTrackedRenderPopout("add-drawing");
}

function addRender() {
  state.renderSectionCollapsed = false;
  activateRenderBoxTool();
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
      render: sourceLayer.render,
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
      vertexOutlineEligibility: deepCopyVertexOutlineEligibility(shape.vertexOutlineEligibility),
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
  syncTrackedRenderPopout("duplicate-drawing");
}

function duplicateRender(renderId) {
  const sourceRender = getRenderById(renderId);
  if (!sourceRender) return;

  const duplicate = createRenderRecord({
    name: `${getRenderTabLabel(sourceRender)} copy`,
    visible: sourceRender.visible !== false,
    layoutPreset: sourceRender.layoutPreset,
    paneDirectionProfiles: sourceRender.paneDirectionProfiles,
    syncFit: sourceRender.syncFit === true,
    boxGeometry: sourceRender.boxGeometry,
    volume: sourceRender.volume,
    sectionSettings: sourceRender.sectionSettings,
  });

  const sourceIndex = state.renders.findIndex((render) => render.id === renderId);
  state.renders.splice(Math.max(0, sourceIndex), 0, duplicate);
  activateRenderBox(duplicate.id);
  syncTrackedRenderPopout("duplicate-rbox");
}

function toggleDrawingVisibility(drawingId) {
  const drawing = getDrawingUiById(drawingId);
  if (!drawing) return;
  drawing.visible = drawing.visible === false;
  renderLayersPanel();
  render();
  syncTrackedRenderPopout("toggle-drawing-visibility");
}

function toggleRenderVisibility(renderId) {
  const renderRecord = getRenderById(renderId);
  if (!renderRecord) return;
  renderRecord.visible = renderRecord.visible === false;
  renderLayersPanel();
  render();
  syncTrackedRenderPopout("toggle-rbox-visibility");
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
  syncTrackedRenderPopout("delete-drawing");
}

function deleteRenderById(renderId) {
  if (isRenderExternalized(renderId)) {
    closeTrackedRenderPopout();
  }
  const index = state.renders.findIndex((render) => render.id === renderId);
  if (index < 0) return;

  state.renders.splice(index, 1);

  if (state.editingRenderId === renderId) {
    state.editingRenderId = null;
    state.editingRenderNameDraft = "";
    state.editingRenderInitialName = "";
  }
  if (state.activeRenderId === renderId) {
    state.activeRenderId = null;
    state.renderTransformDrag = null;
  }
  if (state.renderBoxPropertiesDraft?.renderId === renderId) {
    closeRenderBoxPropertiesModal();
  }

  if (state.activeWorkspaceTab?.kind === "render" && state.activeWorkspaceTab.renderId === renderId) {
    setActiveWorkspaceTab({ kind: "main" });
    return;
  }

  renderLayersPanel();
  render();
  syncTrackedRenderPopout("delete-rbox");
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
    render: cloneLayerRenderSettings(sourceLayer.render),
  };

  state.layers.splice(index + 1, 0, duplicatedLayer);

  const duplicatedShapes = state.shapes
    .filter((shape) => shape.layerId === layerId)
    .map((shape) => ({
      id: "shape-" + state.nextShapeId++,
      layerId: duplicatedLayerId,
      geometry: cloneGeometry(shape.geometry),
      bounds: cloneBounds(shape.bounds),
      vertexOutlineEligibility: deepCopyVertexOutlineEligibility(shape.vertexOutlineEligibility),
    }));

  state.shapes.push(...duplicatedShapes);
  setActiveDrawingById(getLayerDrawingId(duplicatedLayer), { layerId: duplicatedLayerId });
  clearSelection();
  renderLayersPanel();
  render();
  syncTrackedRenderPopout("duplicate-layer");
}

function getLayerTopInsertionIndexForDrawing(drawingId) {
  let lastMatchIndex = -1;

  for (let index = 0; index < state.layers.length; index += 1) {
    if (getLayerDrawingId(state.layers[index]) === drawingId) lastMatchIndex = index;
  }

  return lastMatchIndex === -1 ? state.layers.length : lastMatchIndex + 1;
}

function ensureDrawingHasFallbackLayer(drawingId) {
  const existingLayer = getDrawingLayerFallback(drawingId);
  if (existingLayer) return existingLayer;

  const fallbackLayer = createLayerRecord(drawingId);
  state.layers.splice(getLayerTopInsertionIndexForDrawing(drawingId), 0, fallbackLayer);
  return fallbackLayer;
}

function mergeLayerIntoTarget(sourceLayerId, targetLayerId) {
  if (!sourceLayerId || !targetLayerId || sourceLayerId === targetLayerId) return false;

  const sourceLayer = getLayerById(sourceLayerId);
  const targetLayer = getLayerById(targetLayerId);
  if (!sourceLayer || !targetLayer || sourceLayer.locked || targetLayer.locked) return false;

  const sourceShapes = state.shapes.filter((shape) => shape.layerId === sourceLayerId);
  const targetShapes = state.shapes.filter((shape) => shape.layerId === targetLayerId);
  const combinedShapes = [...targetShapes, ...sourceShapes];
  const nextTargetShapes = combinedShapes.length ? buildUnionShapes(targetLayerId, combinedShapes) : [];

  state.shapes = [
    ...state.shapes.filter((shape) => shape.layerId !== sourceLayerId && shape.layerId !== targetLayerId),
    ...nextTargetShapes,
  ];

  const sourceDrawingId = getLayerDrawingId(sourceLayer);
  const targetDrawingId = getLayerDrawingId(targetLayer);
  state.layers = state.layers.filter((layer) => layer.id !== sourceLayerId);

  if (sourceDrawingId !== targetDrawingId) ensureDrawingHasFallbackLayer(sourceDrawingId);

  const targetDrawing = getDrawingUiById(targetDrawingId);
  if (targetDrawing) targetDrawing.layersSectionCollapsed = false;

  if (state.editingLayerId === sourceLayerId) {
    state.editingLayerId = null;
    state.editingLayerNameDraft = "";
    state.editingLayerInitialName = "";
  }

  clearSelection();
  setActiveDrawingById(targetDrawingId, { layerId: targetLayerId });
  return true;
}

function moveLayerToDrawingTop(layerId, targetDrawingId) {
  const index = state.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return false;

  const movedLayer = state.layers[index];
  const sourceDrawingId = getLayerDrawingId(movedLayer);
  if (!targetDrawingId || sourceDrawingId === targetDrawingId) return false;

  const sourceDrawingLayerCount = getLayersForDrawingInStorageOrder(sourceDrawingId).length;
  const sourceNeedsFallback = sourceDrawingLayerCount <= 1;

  state.layers.splice(index, 1);
  movedLayer.drawingId = targetDrawingId;
  state.layers.splice(getLayerTopInsertionIndexForDrawing(targetDrawingId), 0, movedLayer);

  if (sourceNeedsFallback) ensureDrawingHasFallbackLayer(sourceDrawingId);

  const targetDrawing = getDrawingUiById(targetDrawingId);
  if (targetDrawing) targetDrawing.layersSectionCollapsed = false;

  clearSelection();
  setActiveDrawingById(targetDrawingId, { layerId: movedLayer.id });
  return true;
}

function addLayer(drawingId = getPrimaryDrawingUi().id) {
  const drawing = getDrawingUiById(drawingId) || getPrimaryDrawingUi();
  const layer = createLayerRecord(drawing.id);
  const activeLayer = getActiveLayer();
  const activeLayerIndex = state.layers.findIndex((entry) => entry.id === activeLayer?.id);
  if (activeLayerIndex >= 0) {
    state.layers.splice(activeLayerIndex + 1, 0, layer);
  } else {
    state.layers.push(layer);
  }
  drawing.layersSectionCollapsed = false;
  setActiveDrawingById(drawing.id, { layerId: layer.id });
  clearSelection();
  renderLayersPanel();
  render();
  syncTrackedRenderPopout("add-layer");
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
  syncTrackedRenderPopout("delete-layer");
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

function syncToolControls() {
  selectBtn.classList.toggle("active", state.tool === "select");
  drawBtn.classList.toggle("active", state.tool === "draw");
}

function activateRenderBoxTool() {
  cancelDraftAlignDrag();
  cancelSelectionInteraction();
  cancelDrawInteraction();
  state.panning = false;
  state.draggingDraftOrigin = false;
  state.draftOriginDragRotation = null;
  clearSelection();
  state.activeWorkspaceTab = { kind: "main" };
  state.activeRenderId = null;
  state.renderTransformDrag = null;
  state.tool = "draw";
  state.shapeType = "rbox";
  syncToolControls();
  if (shapeSelect) shapeSelect.value = state.shapeType;
  syncDrawSizeInput();
  updateCursor();
  renderLayersPanel();
  render();
}

function setTool(tool) {
  const previousTool = state.tool;
  if (previousTool === "draw" && tool !== "draw") cancelDrawInteraction();
  if (previousTool === "select" && tool !== "select") cancelSelectionInteraction();

  state.tool = tool;
  syncToolControls();
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

function getResolvedDraftAlignTarget(
  startSnap = state.draftAlignStartSnap,
  endSnap = state.draftAlignCurrentSnap,
  pointerScreen = state.pointerScreen
) {
  if (!startSnap || !endSnap) return null;
  if (endSnap.kind === "corner" || endSnap.kind === "edge") {
    return cloneSnapTarget(endSnap);
  }

  const referenceScreen =
    pointerScreen && Number.isFinite(pointerScreen.x) && Number.isFinite(pointerScreen.y)
      ? pointerScreen
      : worldToScreen(endSnap.world);
  const startScreen = worldToScreen(startSnap.world);
  const dragDxPx = referenceScreen.x - startScreen.x;
  const dragDyPx = referenceScreen.y - startScreen.y;
  const dragDistancePx = Math.hypot(dragDxPx, dragDyPx);
  if (dragDistancePx <= draftAlignActiveAxisSnapMinDragPx) {
    return cloneSnapTarget(endSnap);
  }

  const alignSnapStepDeg = sanitizeAlignSnapValue(state.settings.alignSnap, DEFAULT_SETTINGS.alignSnap);
  const activeFamilyContext = getActiveDraftAngleFamilyContext();
  if (alignSnapStepDeg === "off" || !activeFamilyContext) {
    return cloneSnapTarget(endSnap);
  }

  const startDraft = worldToDraft(startSnap.world);
  const endDraft = worldToDraft(endSnap.world);
  let bestSnap = null;
  for (let angleDeg = 0; angleDeg < 180; angleDeg += alignSnapStepDeg) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const ux = Math.cos(angleRad);
    const uy = Math.sin(angleRad);
    const perpendicularDistancePx = Math.abs(dragDxPx * uy - dragDyPx * ux);
    if (perpendicularDistancePx > draftAlignActiveAxisSnapThresholdPx) continue;

    const projectionDraft = (endDraft.x - startDraft.x) * ux + (endDraft.y - startDraft.y) * uy;
    const snappedDraft = {
      x: startDraft.x + ux * projectionDraft,
      y: startDraft.y + uy * projectionDraft,
    };

    if (!bestSnap || perpendicularDistancePx < bestSnap.perpendicularDistancePx) {
      bestSnap = {
        perpendicularDistancePx,
        snappedDraft,
      };
    }
  }

  if (!bestSnap) {
    return cloneSnapTarget(endSnap);
  }

  const magneticAngleDeg = normalizeDegrees360(
    (Math.atan2(
      bestSnap.snappedDraft.y - startDraft.y,
      bestSnap.snappedDraft.x - startDraft.x
    ) *
      180) /
      Math.PI
  );

  return {
    kind: "free",
    world: draftToWorld(bestSnap.snappedDraft),
    distance: endSnap.distance,
    magnetic: true,
    magneticAngleDeg,
  };
}

function applyDraftAlignFromDrag() {
  const startSnap = state.draftAlignStartSnap;
  const endSnap = getResolvedDraftAlignTarget(startSnap, state.draftAlignCurrentSnap);
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
  if (endSnap.magnetic) {
    const activeFamilyContext = getActiveDraftAngleFamilyContext();
    const familyId = activeFamilyContext?.activeState?.familyId || null;
    const familyStepDegrees = Number(activeFamilyContext?.familyRecord?.stepDegrees);
    const familyStepCount = Number(activeFamilyContext?.familyRecord?.stepCount);
    const activeStepIndex =
      activeFamilyContext?.activeState?.stepIndex ?? activeFamilyContext?.activeRotation?.stepIndex ?? 0;

    if (
      familyId &&
      Number.isFinite(familyStepDegrees) &&
      familyStepDegrees > 0 &&
      Number.isFinite(familyStepCount) &&
      familyStepCount > 0 &&
      Number.isFinite(endSnap.magneticAngleDeg)
    ) {
      const stepOffset = Math.round(endSnap.magneticAngleDeg / familyStepDegrees);
      const targetStepIndex = normalizeDraftAngleStep(activeStepIndex + stepOffset, familyStepCount);
      setActiveDraftAngleFamily(familyId, targetStepIndex);
    } else {
      setDraftAngleFromAlignedDirection(dx, dy);
    }
  } else {
    setDraftAngleFromAlignedDirection(dx, dy);
  }
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

function traceRenderBoxPath(targetCtx, boxGeometry) {
  const points = sanitizeRenderBoxGeometry(boxGeometry);
  if (points.length !== 4) return false;

  targetCtx.beginPath();
  targetCtx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    targetCtx.lineTo(points[index].x, points[index].y);
  }
  targetCtx.closePath();
  return true;
}

function getNormalizedScreenDirection(fromPoint, toPoint, fallback = { x: 1, y: 0 }) {
  const dx = Number(toPoint?.x) - Number(fromPoint?.x);
  const dy = Number(toPoint?.y) - Number(fromPoint?.y);
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return { ...fallback };
  return {
    x: dx / length,
    y: dy / length,
  };
}

function getRenderSideLabelAngle(direction) {
  let angle = Math.atan2(direction.y, direction.x);
  if (angle > Math.PI / 2 || angle <= -Math.PI / 2) {
    angle += Math.PI;
  }
  return angle;
}

function drawRenderBoxEdgeWithGap(targetCtx, start, end, gapHalfLength = 0) {
  const direction = getNormalizedScreenDirection(start, end, { x: 1, y: 0 });
  const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (edgeLength <= 1e-6) return;

  const maxGapHalfLength = Math.max(0, edgeLength / 2 - 2);
  const clampedGapHalfLength = Math.min(maxGapHalfLength, Math.max(0, gapHalfLength));
  if (clampedGapHalfLength <= 0) {
    targetCtx.beginPath();
    targetCtx.moveTo(start.x, start.y);
    targetCtx.lineTo(end.x, end.y);
    targetCtx.stroke();
    return;
  }

  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const gapStart = {
    x: midpoint.x - direction.x * clampedGapHalfLength,
    y: midpoint.y - direction.y * clampedGapHalfLength,
  };
  const gapEnd = {
    x: midpoint.x + direction.x * clampedGapHalfLength,
    y: midpoint.y + direction.y * clampedGapHalfLength,
  };

  targetCtx.beginPath();
  targetCtx.moveTo(start.x, start.y);
  targetCtx.lineTo(gapStart.x, gapStart.y);
  targetCtx.moveTo(gapEnd.x, gapEnd.y);
  targetCtx.lineTo(end.x, end.y);
  targetCtx.stroke();
}

function drawRenderBoxOverlay(renderRecord, options = {}) {
  const metrics = getRenderBoxMetrics(renderRecord);
  if (!metrics.isValid || !metrics.boxGeometry.length) return;

  const isActive = options.isActive === true;
  const screenPoints = metrics.boxGeometry.map((point) => worldToScreen(point));
  const screenTopLeft = screenPoints[0];
  const screenTopRight = screenPoints[1];
  const screenBottomLeft = screenPoints[3];
  const sideLabels = [
    { label: "T", startIndex: 0, endIndex: 1 },
    { label: "R", startIndex: 1, endIndex: 2 },
    { label: "B", startIndex: 2, endIndex: 3 },
    { label: "L", startIndex: 3, endIndex: 0 },
  ];
  const topEdgeDirection = getNormalizedScreenDirection(screenTopLeft, screenTopRight, { x: 1, y: 0 });
  const leftEdgeDirection = getNormalizedScreenDirection(screenTopLeft, screenBottomLeft, { x: 0, y: 1 });
  const labelOffsetAlongTopPx = 6;
  const labelOffsetOutwardPx = 6;
  const labelAnchor = {
    x: screenTopLeft.x + topEdgeDirection.x * labelOffsetAlongTopPx - leftEdgeDirection.x * labelOffsetOutwardPx,
    y: screenTopLeft.y + topEdgeDirection.y * labelOffsetAlongTopPx - leftEdgeDirection.y * labelOffsetOutwardPx,
  };
  const labelAngle = Math.atan2(topEdgeDirection.y, topEdgeDirection.x);

  ctx.save();
  ctx.strokeStyle = renderBoxStrokeColorSoft;
  ctx.lineWidth = isActive ? 1.5 : 1;
  ctx.setLineDash(isActive ? [8, 4] : [5, 4]);
  ctx.font = renderBoxSideLabelFont;
  sideLabels.forEach(({ label, startIndex, endIndex }) => {
    const start = screenPoints[startIndex];
    const end = screenPoints[endIndex];
    const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
    const gapHalfLength = Math.min(edgeLength / 2 - 2, ctx.measureText(label).width / 2 + 5);
    drawRenderBoxEdgeWithGap(ctx, start, end, gapHalfLength);
  });
  ctx.restore();

  ctx.save();
  ctx.font = renderBoxLabelFont;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = renderBoxStrokeColor;
  ctx.translate(labelAnchor.x, labelAnchor.y);
  ctx.rotate(labelAngle);
  ctx.fillText(getRenderTabLabel(renderRecord), 0, 0);
  ctx.restore();

  ctx.save();
  ctx.font = renderBoxSideLabelFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = renderBoxStrokeColor;
  sideLabels.forEach(({ label, startIndex, endIndex }) => {
    const start = screenPoints[startIndex];
    const end = screenPoints[endIndex];
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const direction = getNormalizedScreenDirection(start, end, { x: 1, y: 0 });
    const labelAngleForEdge = getRenderSideLabelAngle(direction);
    ctx.save();
    ctx.translate(midpoint.x, midpoint.y);
    ctx.rotate(labelAngleForEdge);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function renderRenderBoxOverlays() {
  const inactiveRenders = state.renders.filter((renderRecord) => renderRecord.visible !== false && renderRecord.id !== state.activeRenderId);
  for (const renderRecord of inactiveRenders) {
    if (renderRecord.visible === false) continue;
    drawRenderBoxOverlay(renderRecord, { isActive: false });
  }

  const activeRender = getSelectedRenderRecord();
  if (activeRender && activeRender.visible !== false) {
    drawRenderBoxOverlay(activeRender, { isActive: true });
  }
}

function drawPendingRenderBoxPreview() {
  const previewGeometry = sanitizeRenderBoxGeometry(state.pendingRenderBox?.boxGeometry);
  if (previewGeometry.length !== 4) return;

  ctx.save();
  applyWorldCameraTransform(ctx);
  if (!traceRenderBoxPath(ctx, previewGeometry)) {
    ctx.restore();
    return;
  }
  ctx.strokeStyle = renderBoxStrokeColor;
  ctx.lineWidth = 2 / state.camera.zoom;
  ctx.setLineDash([10 / state.camera.zoom, 6 / state.camera.zoom]);
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

function drawLayerMerged(layer, options = {}) {
  const { renderFill = true, renderOutline = true, renderCorners = true } = options;
  const layerShapes = state.shapes.filter((shape) => shape.layerId === layer.id);
  if (!layerShapes.length || (!renderFill && !renderOutline && !renderCorners)) return;

  ctx.save();
  applyWorldCameraTransform(ctx);
  const isActiveLayer = layer.id === state.activeLayerId;
  const isActiveLayerInDrawMode = state.tool === "draw" && isActiveLayer;
  const layerOpacity = Math.max(0, Math.min(1, Number.isFinite(layer.opacity) ? layer.opacity : 1));
  const drawModeOpacityFactor = state.tool === "draw" && !isActiveLayer ? inactiveLayerDrawModeOpacityFactor : 1;
  ctx.globalAlpha = layerOpacity * drawModeOpacityFactor;
  const outlineEnabled = !!state.settings.outlineEnabled;
  const cornersEnabled = outlineEnabled && !!state.settings.cornersEnabled;
  const outlineColor = sanitizeColorValue(state.settings.outlineColor, DEFAULT_SETTINGS.outlineColor);
  const effectiveOutlineColor = isActiveLayerInDrawMode ? previewStrokeColor : outlineColor;
  const shouldRenderOutline = renderOutline && (outlineEnabled || isActiveLayerInDrawMode);
  const shouldRenderCorners = renderCorners && (cornersEnabled || isActiveLayerInDrawMode);
  const outlineWidth =
    (isActiveLayerInDrawMode ? activeLayerOutlineWidthFactor : 1) / state.camera.zoom;
  const vertexRadius =
    ((isActiveLayerInDrawMode ? activeLayerVertexRadiusFactor : 1) * vertexMarkerRadiusPx) /
    state.camera.zoom;

  for (const shape of layerShapes) {
    if (renderFill) {
      ctx.beginPath();
      traceGeometryPath(ctx, shape.geometry);
      ctx.fillStyle = layer.fillColor;
      ctx.fill("evenodd");
    }

    if (shouldRenderOutline) {
      if (!renderFill) {
        ctx.beginPath();
        traceGeometryPath(ctx, shape.geometry);
      }
      ctx.strokeStyle = effectiveOutlineColor;
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    }

    if (shouldRenderCorners) {
      ctx.beginPath();
      drawGeometryVertices(ctx, shape.geometry, vertexRadius, shape.vertexOutlineEligibility, false);
      ctx.fillStyle = hiddenOutlineVertexColor;
      ctx.fill();

      ctx.beginPath();
      drawGeometryVertices(ctx, shape.geometry, vertexRadius, shape.vertexOutlineEligibility, true);
      ctx.fillStyle = effectiveOutlineColor;
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawWorldAxes() {
  const { width, height } = getCanvasViewportSize();
  const worldCorners = [
    screenToWorld({ x: 0, y: 0 }),
    screenToWorld({ x: width, y: 0 }),
    screenToWorld({ x: width, y: height }),
    screenToWorld({ x: 0, y: height }),
  ];
  const worldAxisHalfSpan =
    Math.max(
      1,
      ...worldCorners.map((point) => Math.max(Math.abs(point.x), Math.abs(point.y)))
    ) + 512;

  ctx.save();
  applyWorldCameraTransform(ctx);
  ctx.beginPath();
  ctx.strokeStyle = state.tool === "draw" ? worldAxisStrokeColorDrawMode : worldAxisStrokeColor;
  ctx.lineWidth = 1 / state.camera.zoom;
  ctx.moveTo(-worldAxisHalfSpan, 0);
  ctx.lineTo(worldAxisHalfSpan, 0);
  ctx.moveTo(0, -worldAxisHalfSpan);
  ctx.lineTo(0, worldAxisHalfSpan);
  ctx.stroke();
  ctx.restore();
}

function drawDraftGridAndAxes() {
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
  ctx.strokeStyle = previewStrokeColor;
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
  context.moveTo(x, invert ? 0 : thickness);
  context.lineTo(x, invert ? thickness - tick : tick);
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
  context.moveTo(invert ? 0 : thickness, y);
  context.lineTo(invert ? thickness - tick : tick, y);
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

function getActiveDrawPreviewState() {
  if (!state.pointerInCanvas || state.panning || state.draggingDraftOrigin || state.spacePressed) return null;
  if (state.activeRenderId) return null;
  if (state.tool !== "draw") return null;

  const activeLayer = getActiveLayer();
  if (!isLayerAvailableForEditing(activeLayer)) return null;

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

  if (!snapPoint) return null;

  return {
    snapPoint,
    isSubtract: state.dragging && state.drawOperation === "subtract",
  };
}

function getActiveDrawRulerIndicatorBounds(previewState = getActiveDrawPreviewState()) {
  if (!previewState) return null;

  if (isSquareBrushShapeType()) {
    const draftGeometry =
      state.dragging && state.brushPoints.length
        ? buildSquareBrushStrokeDraftGeometry(state.brushPoints, state.drawSize)
        : createSquareBrushDabGeometry(previewState.snapPoint, state.drawSize);
    return getGeometryBounds(draftGeometry);
  }

  if (state.dragging && state.draftStart) {
    if (isStripShapeType()) {
      const segment = getSnappedStripSegment(state.draftStart, state.draftCurrent);
      return getGeometryBounds(createStripGeometry(segment.start, segment.end, getStripWidthInDraftUnits()).geometry);
    }

    if (isBoxSnapShapeType()) {
      return normalizeRect(snapDraftPointToGrid(state.draftStart), snapDraftPointToGrid(state.draftCurrent));
    }
  }

  return {
    x: previewState.snapPoint.x,
    y: previewState.snapPoint.y,
    w: 0,
    h: 0,
  };
}

function getRulerPreviewIndicatorColors(isSubtract = false, shapeType = state.shapeType) {
  return isSubtract
    ? {
        fill: "#dc2626",
      }
    : {
        fill: isRenderBoxShapeType(shapeType) ? renderBoxStrokeColor : previewStrokeColor,
      };
}

function getClampedRulerIndicatorSpan(start, end, surfaceLength, radius = rulerPreviewIndicatorThicknessPx / 2) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(surfaceLength) || surfaceLength <= 0) return null;

  const padding = 1 + radius;
  const usableLength = Math.max(0, surfaceLength - padding * 2);
  if (usableLength <= 0) return null;

  const center = (start + end) / 2;
  const requestedLength = Math.max(rulerPreviewIndicatorMinLengthPx, Math.abs(end - start));
  const spanLength = Math.min(usableLength, requestedLength);
  let clampedStart = center - spanLength / 2;
  let clampedEnd = center + spanLength / 2;

  if (clampedStart < padding) {
    clampedEnd += padding - clampedStart;
    clampedStart = padding;
  }

  if (clampedEnd > surfaceLength - padding) {
    clampedStart -= clampedEnd - (surfaceLength - padding);
    clampedEnd = surfaceLength - padding;
  }

  return {
    start: Math.max(padding, clampedStart),
    end: Math.min(surfaceLength - padding, clampedEnd),
  };
}

function traceHorizontalRulerCapsule(context, start, end, top, height) {
  const radius = height / 2;
  const leftCenterX = Math.min(start, end);
  const rightCenterX = Math.max(start, end);
  const centerY = top + radius;

  context.rect(leftCenterX, top, Math.max(0, rightCenterX - leftCenterX), height);
  context.moveTo(leftCenterX + radius, centerY);
  context.arc(leftCenterX, centerY, radius, 0, Math.PI * 2);
  context.moveTo(rightCenterX + radius, centerY);
  context.arc(rightCenterX, centerY, radius, 0, Math.PI * 2);
}

function traceVerticalRulerCapsule(context, left, start, end, width) {
  const radius = width / 2;
  const topCenterY = Math.min(start, end);
  const bottomCenterY = Math.max(start, end);
  const centerX = left + radius;

  context.rect(left, topCenterY, width, Math.max(0, bottomCenterY - topCenterY));
  context.moveTo(centerX + radius, topCenterY);
  context.arc(centerX, topCenterY, radius, 0, Math.PI * 2);
  context.moveTo(centerX + radius, bottomCenterY);
  context.arc(centerX, bottomCenterY, radius, 0, Math.PI * 2);
}

function drawDraftRulerPreviewIndicator(bounds, isSubtract, dimensions) {
  if (!bounds) return;

  const { topWidth, leftHeight, topThickness, leftThickness, bottomThickness, rightThickness } = dimensions;
  const colors = getRulerPreviewIndicatorColors(isSubtract);
  const radius = rulerPreviewIndicatorThicknessPx / 2;
  const startScreen = draftToScreen({ x: bounds.x, y: bounds.y });
  const endScreen = draftToScreen({ x: bounds.x + bounds.w, y: bounds.y + bounds.h });
  const horizontalSpan = getClampedRulerIndicatorSpan(startScreen.x, endScreen.x, topWidth, radius);
  const verticalSpan = getClampedRulerIndicatorSpan(startScreen.y, endScreen.y, leftHeight, radius);
  const horizontalTop = Math.max(1, topThickness - rulerPreviewIndicatorInsetPx - rulerPreviewIndicatorThicknessPx);
  const horizontalBottom = rulerPreviewIndicatorInsetPx;
  const verticalLeft = Math.max(1, leftThickness - rulerPreviewIndicatorInsetPx - rulerPreviewIndicatorThicknessPx);
  const verticalRight = rulerPreviewIndicatorInsetPx;

  if (horizontalSpan) {
    for (const [context, top] of [
      [draftRulerTopCtx, horizontalTop],
      [draftRulerBottomCtx, horizontalBottom],
    ]) {
      context.save();
      context.beginPath();
      traceHorizontalRulerCapsule(
        context,
        horizontalSpan.start,
        horizontalSpan.end,
        top,
        rulerPreviewIndicatorThicknessPx
      );
      context.fillStyle = colors.fill;
      context.fill();
      context.restore();
    }
  }

  if (verticalSpan) {
    for (const [context, left] of [
      [draftRulerLeftCtx, verticalLeft],
      [draftRulerRightCtx, verticalRight],
    ]) {
      context.save();
      context.beginPath();
      traceVerticalRulerCapsule(
        context,
        left,
        verticalSpan.start,
        verticalSpan.end,
        rulerPreviewIndicatorThicknessPx
      );
      context.fillStyle = colors.fill;
      context.fill();
      context.restore();
    }
  }
}

function drawDraftRulers() {
  const metrics = getAdaptiveGridMetrics();
  const topWidth = Math.round(draftRulerTop.clientWidth);
  const leftHeight = Math.round(draftRulerLeft.clientHeight);
  const topThickness = Math.round(draftRulerTop.clientHeight);
  const leftThickness = Math.round(draftRulerLeft.clientWidth);
  const bottomThickness = Math.round(draftRulerBottom.clientHeight);
  const rightThickness = Math.round(draftRulerRight.clientWidth);
  const previewState = getActiveDrawPreviewState();
  const previewBounds = getActiveDrawRulerIndicatorBounds(previewState);
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
  if (step > 1) {
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

  drawDraftRulerPreviewIndicator(previewBounds, previewState?.isSubtract, {
    topWidth,
    leftHeight,
    topThickness,
    leftThickness,
    bottomThickness,
    rightThickness,
  });
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

  const startSnap = state.draggingDraftAlign ? state.draftAlignStartSnap : null;
  const hoverSnap = state.draggingDraftAlign
    ? getResolvedDraftAlignTarget(startSnap, state.draftAlignCurrentSnap)
    : getDraftTransformSnapTarget(state.current, undefined, { allowEdge: false });

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
  const previewState = getActiveDrawPreviewState();
  if (!previewState) return;

  const { snapPoint, isSubtract } = previewState;
  const screenPoint = draftToScreen(snapPoint);
  const drawPreviewColor = isRenderBoxShapeType() ? renderBoxStrokeColor : previewStrokeColor;

  if (isSquareBrushShapeType()) {
    const brushSize = getSquareBrushSizeInDraftUnits();
    const half = brushSize / 2;
    const topLeft = draftToScreen({ x: snapPoint.x - half, y: snapPoint.y - half });
    const screenSize = brushSize * state.camera.zoom;

    ctx.save();
    ctx.fillStyle = isSubtract ? "rgba(239, 68, 68, 0.14)" : "rgba(14, 165, 233, 0.14)";
    ctx.strokeStyle = isSubtract ? "#dc2626" : drawPreviewColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.rect(topLeft.x, topLeft.y, screenSize, screenSize);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isSubtract ? "#dc2626" : drawPreviewColor;
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
  ctx.fillStyle = isSubtract ? "#dc2626" : drawPreviewColor;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(screenPoint.x - size / 2, screenPoint.y - size / 2, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function render() {
  renderWorkspaceUi();
  const { width, height } = getCanvasViewportSize();
  ctx.clearRect(0, 0, width, height);
  if (!isMainWorkspaceActive()) return;
  drawWorldAxes();

  for (const layer of getRenderableLayersInPaintOrder()) {
    if (!isLayerActuallyVisible(layer)) continue;
    drawLayerMerged(layer);
  }

  if (state.tool === "draw") {
    drawDraftGridAndAxes();
  }

  const activeLayer = getActiveLayer();
  if (state.tool === "draw" && isLayerActuallyVisible(activeLayer)) {
    drawLayerMerged(activeLayer, { renderFill: false });
  }

  renderRenderBoxOverlays();

  if (state.dragging && state.tool === "draw" && isRenderBoxShapeType()) {
    drawPendingRenderBoxPreview();
  } else if (state.dragging && state.tool === "draw" && isLayerAvailableForEditing(activeLayer)) {
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

  const activeRender = getSelectedRenderRecord();
  if (activeRender) {
    if (e.button !== 0) return;
    const hit = getRenderTransformHit(activeRender, world);
    if (!hit) {
      updateCursor();
      render();
      return;
    }

    state.dragging = true;
    state.renderTransformDrag = {
      renderId: activeRender.id,
      startWorld: { ...world },
      startBoxGeometry: cloneRenderBoxGeometry(activeRender.boxGeometry),
    };
    updateCursor();
    canvas.setPointerCapture(e.pointerId);
    render();
    return;
  }

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

  if (state.tool === "draw" && isRenderBoxShapeType()) {
    if (e.button !== 0) return;

    state.dragging = true;
    state.start = world;
    state.draftStart = draft;
    state.drawOperation = "add";
    resetDrawSession();
    state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
    state.pendingRenderBox = {
      startDraft: cloneDraftPoint(state.draftStart),
      currentDraft: cloneDraftPoint(state.draftCurrent),
      boxGeometry: getRenderBoxGeometryFromDraftRect(state.draftStart, state.draftCurrent),
    };
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
    updateCursor();
    render();
    return;
  }

  if (state.renderTransformDrag) {
    const drag = state.renderTransformDrag;
    const renderRecord = getRenderById(drag.renderId);
    if (renderRecord) {
      const dx = state.current.x - drag.startWorld.x;
      const dy = state.current.y - drag.startWorld.y;
      renderRecord.boxGeometry = drag.startBoxGeometry.map((point) =>
        quantizePoint({
          x: point.x + dx,
          y: point.y + dy,
        })
      );
    }
    updateCursor();
    render();
    return;
  }

  if (!state.dragging) {
    updateCursor();
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
    if (isRenderBoxShapeType()) {
      state.draftShape = makeDraftShape(state.draftStart, state.draftCurrent);
      state.pendingRenderBox = {
        startDraft: cloneDraftPoint(state.draftStart),
        currentDraft: cloneDraftPoint(state.draftCurrent),
        boxGeometry: getRenderBoxGeometryFromDraftRect(state.draftStart, state.draftCurrent),
      };
    } else if (isSquareBrushShapeType()) {
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

  if (state.renderTransformDrag) {
    state.renderTransformDrag = null;
    state.dragging = false;
    updateCursor();
    render();
    syncTrackedRenderPopout("transform-rbox");
    return;
  }

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
    if (affectedLayerIds.length) {
      syncTrackedRenderPopout("transform-geometry");
    }
    return;
  }

  if (state.tool === "draw") {
    let didCommitRenderChange = false;
    if (isRenderBoxShapeType()) {
      const previewGeometry = cloneRenderBoxGeometry(state.pendingRenderBox?.boxGeometry);
      if (state.draftShape && !state.draftShape.small && previewGeometry.length === 4) {
        materializeActiveDraftAngleCandidateOnCommit();
        const renderRecord = createRenderRecord({
          boxGeometry: previewGeometry,
        });
        state.renders.unshift(renderRecord);
        state.renderSectionCollapsed = false;
        state.activeRenderId = renderRecord.id;
        renderLayersPanel();
        didCommitRenderChange = true;
      }
    } else if (state.draftShape && !state.draftShape.small) {
      materializeActiveDraftAngleCandidateOnCommit();
      if (state.drawOperation === "subtract") {
        subtractGeometryFromLayer(
          state.activeLayerId,
          state.draftShape.geometry,
          state.draftShape.vertexOutlineEligibility
        );
      } else {
        const shape = createShapeRecord(state.activeLayerId, state.draftShape.geometry, null, {
          vertexOutlineEligibility: state.draftShape.vertexOutlineEligibility,
          defaultOutlineEligible: getDefaultOutlineEligibilityForShapeType(),
        });
        if (shape) insertShapeToLayer(state.activeLayerId, shape);
      }
      renderLayersPanel();
      didCommitRenderChange = true;
    }

    if (didCommitRenderChange) {
      syncTrackedRenderPopout(isRenderBoxShapeType() ? "create-rbox" : "commit-draw");
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
  updateCursor();
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

if (exportButton) {
  exportButton.addEventListener("click", () => {
    void handleProjectExport();
  });
}

if (layerSettingsButton) {
  layerSettingsButton.addEventListener("click", () => {
    if (isLayerSettingsMenuOpen()) {
      closeLayerSettingsModal();
      return;
    }

    openLayerSettingsModal();
  });
}

if (renderSettingsButton) {
  renderSettingsButton.addEventListener("click", () => {
    if (isRenderSettingsMenuOpen()) {
      closeRenderSettingsMenu();
      return;
    }

    openRenderSettingsMenu();
  });
}

if (importButton) {
  importButton.addEventListener("click", () => {
    if (!projectImportInput) {
      window.alert("Import is not available.");
      return;
    }

    projectImportInput.value = "";
    projectImportInput.click();
  });
}

if (projectImportInput) {
  projectImportInput.addEventListener("change", () => {
    const [file] = projectImportInput.files || [];
    void handleProjectImportFile(file || null);
    projectImportInput.value = "";
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

if (exportFallbackCloseButton) {
  exportFallbackCloseButton.addEventListener("click", () => {
    closeExportFallbackMenu();
  });
}

if (layerSettingsCloseButton) {
  layerSettingsCloseButton.addEventListener("click", () => {
    closeLayerSettingsModal();
  });
}

if (layerSettingsApplyButton) {
  layerSettingsApplyButton.addEventListener("click", () => {
    applyLayerSettingsDraft();
    closeLayerSettingsModal();
  });
}

if (renderSettingsCloseButton) {
  renderSettingsCloseButton.addEventListener("click", () => {
    closeRenderSettingsMenu();
  });
}

if (renderSettingsApplyButton) {
  renderSettingsApplyButton.addEventListener("click", () => {
    applyRenderSettingsDraft();
    closeRenderSettingsMenu();
  });
}

if (renderBoxPropertiesCloseButton) {
  renderBoxPropertiesCloseButton.addEventListener("click", () => {
    closeRenderBoxPropertiesModal();
  });
}

if (renderBoxPropertiesApplyButton) {
  renderBoxPropertiesApplyButton.addEventListener("click", () => {
    if (!state.renderBoxPropertiesDraft) return;

    const displayUnitId = state.settings.displayUnit;
    const parsedHeightMm = renderBoxPropertiesHeightInput
      ? parseLayerSettingsLengthInput(renderBoxPropertiesHeightInput.value, displayUnitId)
      : null;
    const parsedStartMm = renderBoxPropertiesStartInput
      ? parseLayerSettingsLengthInput(renderBoxPropertiesStartInput.value, displayUnitId)
      : null;
    const parsedEndMm = renderBoxPropertiesEndInput
      ? parseLayerSettingsLengthInput(renderBoxPropertiesEndInput.value, displayUnitId)
      : null;

    if (parsedHeightMm !== null) {
      state.renderBoxPropertiesDraft.heightMm = Math.max(0, parsedHeightMm);
    }
    if (parsedStartMm !== null) {
      state.renderBoxPropertiesDraft.baseElevationMm = parsedStartMm;
    } else if (parsedEndMm !== null) {
      state.renderBoxPropertiesDraft.baseElevationMm = quantizeCoordinate(parsedEndMm - state.renderBoxPropertiesDraft.heightMm);
    }

    applyRenderBoxPropertiesDraft();
    closeRenderBoxPropertiesModal();
  });
}

if (modalBackdrop) {
  modalBackdrop.addEventListener("click", () => {
    closeSettingsMenu();
    closeExportFallbackMenu();
    closeLayerSettingsModal();
    closeRenderBoxPropertiesModal();
    closeRenderSettingsMenu();
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

for (const button of settingsAlignSnapButtons) {
  button.addEventListener("click", () => {
    if (!state.settingsDraft) return;
    state.settingsDraft.alignSnap = sanitizeAlignSnapValue(
      button.dataset.settingsAlignSnap,
      state.settingsDraft.alignSnap
    );
    syncSettingsMenu();
  });
}

for (const button of settingsOutlineButtons) {
  button.addEventListener("click", () => {
    if (!state.settingsDraft) return;
    state.settingsDraft.outlineEnabled = sanitizeSettingsToggle(
      button.dataset.settingsOutlineEnabled,
      state.settingsDraft.outlineEnabled
    );
    syncSettingsMenu();
  });
}

for (const button of settingsCornersButtons) {
  button.addEventListener("click", () => {
    if (!state.settingsDraft || !state.settingsDraft.outlineEnabled) return;
    state.settingsDraft.cornersEnabled = sanitizeSettingsToggle(
      button.dataset.settingsCornersEnabled,
      state.settingsDraft.cornersEnabled
    );
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

if (settingsOutlineColorInput) {
  settingsOutlineColorInput.addEventListener("input", (event) => {
    if (!state.settingsDraft) return;
    state.settingsDraft.outlineColor = sanitizeColorValue(event.target.value, state.settingsDraft.outlineColor);
    syncSettingsMenu();
  });
}

for (const button of renderDepthModeButtons) {
  button.addEventListener("click", () => {
    if (!state.renderSettingsDraft) return;
    const nextMode = sanitizeRenderDepthMode(button.dataset.renderDepthMode, state.renderSettingsDraft.depthEffect.mode);
    state.renderSettingsDraft.depthEffect.mode = nextMode;
    state.renderSettingsDraft.depthEffect.enabled = nextMode !== "off";
    syncRenderSettingsMenu();
  });
}

for (const button of renderOutlineButtons) {
  button.addEventListener("click", () => {
    if (!state.renderSettingsDraft) return;
    state.renderSettingsDraft.outlineEffect.enabled = button.dataset.renderOutline === "on";
    syncRenderSettingsMenu();
  });
}

if (renderDepthStrengthDecrease) {
  renderDepthStrengthDecrease.addEventListener("click", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.depthEffect.enabled) return;
    state.renderSettingsDraft.depthEffect.strength = sanitizeRenderDepthStrength(
      state.renderSettingsDraft.depthEffect.strength - 1,
      state.renderSettingsDraft.depthEffect.strength
    );
    syncRenderSettingsMenu();
  });
}

if (renderOutlineColorInput) {
  renderOutlineColorInput.addEventListener("input", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.outlineEffect.enabled) return;
    state.renderSettingsDraft.outlineEffect.color = sanitizeColorValue(
      renderOutlineColorInput.value,
      state.renderSettingsDraft.outlineEffect.color
    );
  });

  renderOutlineColorInput.addEventListener("change", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.outlineEffect.enabled) return;
    state.renderSettingsDraft.outlineEffect.color = sanitizeColorValue(
      renderOutlineColorInput.value,
      state.renderSettingsDraft.outlineEffect.color
    );
    syncRenderSettingsMenu();
  });
}

if (renderOutlineWidthInput) {
  renderOutlineWidthInput.addEventListener("input", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.outlineEffect.enabled) return;
    state.renderSettingsDraft.outlineEffect.thickness = sanitizeRenderOutlineThickness(
      renderOutlineWidthInput.value,
      state.renderSettingsDraft.outlineEffect.thickness
    );
  });

  renderOutlineWidthInput.addEventListener("change", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.outlineEffect.enabled) return;
    state.renderSettingsDraft.outlineEffect.thickness = sanitizeRenderOutlineThickness(
      renderOutlineWidthInput.value,
      state.renderSettingsDraft.outlineEffect.thickness
    );
    syncRenderSettingsMenu();
  });
}

if (renderDepthStrengthIncrease) {
  renderDepthStrengthIncrease.addEventListener("click", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.depthEffect.enabled) return;
    state.renderSettingsDraft.depthEffect.strength = sanitizeRenderDepthStrength(
      state.renderSettingsDraft.depthEffect.strength + 1,
      state.renderSettingsDraft.depthEffect.strength
    );
    syncRenderSettingsMenu();
  });
}

if (renderDepthStrengthValue) {
  renderDepthStrengthValue.addEventListener("input", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.depthEffect.enabled) return;
    if (renderDepthStrengthValue.value.trim() === "") return;
    state.renderSettingsDraft.depthEffect.strength = sanitizeRenderDepthStrength(
      renderDepthStrengthValue.value,
      state.renderSettingsDraft.depthEffect.strength
    );
  });

  renderDepthStrengthValue.addEventListener("change", () => {
    if (!state.renderSettingsDraft || !state.renderSettingsDraft.depthEffect.enabled) return;
    state.renderSettingsDraft.depthEffect.strength = sanitizeRenderDepthStrength(
      renderDepthStrengthValue.value,
      state.renderSettingsDraft.depthEffect.strength
    );
    syncRenderSettingsMenu();
  });
}

if (renderBoxPropertiesHeightInput) {
  renderBoxPropertiesHeightInput.addEventListener("input", () => {
    if (!state.renderBoxPropertiesDraft) return;
    const parsedHeightMm = parseLayerSettingsLengthInput(renderBoxPropertiesHeightInput.value, state.settings.displayUnit);
    if (parsedHeightMm === null) return;
    state.renderBoxPropertiesDraft.heightMm = Math.max(0, parsedHeightMm);
    syncRenderBoxPropertiesModal();
  });

  renderBoxPropertiesHeightInput.addEventListener("change", syncRenderBoxPropertiesModal);
  renderBoxPropertiesHeightInput.addEventListener("blur", syncRenderBoxPropertiesModal);
}

if (renderBoxPropertiesStartInput) {
  renderBoxPropertiesStartInput.addEventListener("input", () => {
    if (!state.renderBoxPropertiesDraft) return;
    const parsedStartMm = parseLayerSettingsLengthInput(renderBoxPropertiesStartInput.value, state.settings.displayUnit);
    if (parsedStartMm === null) return;
    state.renderBoxPropertiesDraft.baseElevationMm = parsedStartMm;
    syncRenderBoxPropertiesModal();
  });

  renderBoxPropertiesStartInput.addEventListener("change", syncRenderBoxPropertiesModal);
  renderBoxPropertiesStartInput.addEventListener("blur", syncRenderBoxPropertiesModal);
}

if (renderBoxPropertiesEndInput) {
  renderBoxPropertiesEndInput.addEventListener("input", () => {
    if (!state.renderBoxPropertiesDraft) return;
    const parsedEndMm = parseLayerSettingsLengthInput(renderBoxPropertiesEndInput.value, state.settings.displayUnit);
    if (parsedEndMm === null) return;
    state.renderBoxPropertiesDraft.baseElevationMm = quantizeCoordinate(parsedEndMm - state.renderBoxPropertiesDraft.heightMm);
    syncRenderBoxPropertiesModal();
  });

  renderBoxPropertiesEndInput.addEventListener("change", syncRenderBoxPropertiesModal);
  renderBoxPropertiesEndInput.addEventListener("blur", syncRenderBoxPropertiesModal);
}

shapeSelect.addEventListener("change", (e) => {
  state.shapeType = sanitizeProjectShapeType(e.target.value, state.shapeType);
  if (isRenderBoxShapeType()) {
    state.activeWorkspaceTab = { kind: "main" };
    state.activeRenderId = null;
    renderLayersPanel();
  }
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
  layerFillInput.addEventListener("change", () => {
    syncTrackedRenderPopout("layer-color-change");
  });
}

if (layerSectionToggle) {
  layerSectionToggle.addEventListener("click", () => {
    state.layerSectionCollapsed = !state.layerSectionCollapsed;
    renderLayersPanel();
  });
}

if (renderSectionToggle) {
  renderSectionToggle.addEventListener("click", () => {
    state.renderSectionCollapsed = !state.renderSectionCollapsed;
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

if (addRenderBtn) {
  addRenderBtn.addEventListener("click", () => {
    state.renderSectionCollapsed = false;
    addRender();
  });
}

for (const button of renderLayoutButtons) {
  button.addEventListener("click", () => {
    const activeRender = getActiveRenderRecord();
    if (!activeRender) return;
    const nextPreset = sanitizeRenderLayoutPreset(button.dataset.renderLayout, state.renderLayoutPreset);
    if (state.renderLayoutPreset === nextPreset) return;
    state.renderLayoutPreset = nextPreset;
    activeRender.layoutPreset = nextPreset;
    renderWorkspaceUi();
  });
}

if (renderSyncFitButton) {
  renderSyncFitButton.addEventListener("click", () => {
    const activeRender = getActiveRenderRecord();
    if (!activeRender) return;
    activeRender.syncFit = !(activeRender.syncFit === true);
    renderWorkspaceUi();
  });
}

if (renderPopoutButton) {
  renderPopoutButton.addEventListener("click", () => {
    if (isRenderPopoutWindow()) {
      try {
        window.close();
      } catch {}
      return;
    }

    const activeRender = getActiveRenderRecord();
    if (!activeRender) return;

    if (isRenderExternalized(activeRender.id)) {
      closeTrackedRenderPopout();
      return;
    }

    openTrackedRenderPopout(activeRender.id);
  });
}

for (const button of renderPaneSelectorButtons) {
  button.addEventListener("click", () => {
    const slotIndex = Number(button.dataset.renderSlot);
    const direction = button.dataset.renderDirection;
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return;
    setRenderPaneDirection(slotIndex, direction);
  });
}

window.addEventListener("pointermove", (event) => {
  const drag = state.leftPanelPointerDrag;
  if (drag && event.pointerId === drag.pointerId) {
    if (drag.type === "drawing") {
      const drop = drawingDropPositionFromClientY(event.clientY, drag.drawingId);
      drag.dropIndex = drop.toIndex;
      drag.rawIndex = drop.rawIndex;
      drag.fromIndex = drop.fromIndex;
      updateDrawingDropIndicator(drop.rawIndex, drop.toIndex, drop.fromIndex);
    } else if (drag.type === "render") {
      const drop = renderDropPositionFromClientY(event.clientY, drag.renderId);
      drag.dropIndex = drop.toIndex;
      drag.rawIndex = drop.rawIndex;
      drag.fromIndex = drop.fromIndex;
      updateRenderDropIndicator(drop.rawIndex, drop.toIndex, drop.fromIndex);
    } else {
      const targetLayerId = getLayerMergeTargetLayerId(event.clientX, event.clientY, drag.layerId);
      if (targetLayerId) {
        drag.targetMode = "merge";
        drag.targetLayerId = targetLayerId;
        drag.targetDrawingId = null;
        drag.dropIndex = -1;
        drag.rawIndex = -1;
        updateLayerTransferTargetIndicator(null);
        updateLayerDropIndicator(drag.drawingId, -1, -1, drag.fromIndex);
        updateLayerMergeTargetIndicator(targetLayerId);
        return;
      }

      const targetDrawingId = getLayerTransferTargetDrawingId(event.clientX, event.clientY, drag.drawingId);
      if (targetDrawingId) {
        drag.targetMode = "drawing";
        drag.targetDrawingId = targetDrawingId;
        drag.targetLayerId = null;
        drag.dropIndex = -1;
        drag.rawIndex = -1;
        updateLayerMergeTargetIndicator(null);
        updateLayerDropIndicator(drag.drawingId, -1, -1, drag.fromIndex);
        updateLayerTransferTargetIndicator(targetDrawingId);
        return;
      }

      const sourceDrawingCard = getDrawingCardElement(drag.drawingId);
      const isInsideSourceDrawing =
        !!sourceDrawingCard && isClientPointInsideRect(event.clientX, event.clientY, sourceDrawingCard.getBoundingClientRect());

      if (isInsideSourceDrawing) {
        const drop = layerDropPositionFromClientY(drag.drawingId, event.clientY, drag.layerId);
        drag.targetMode = "reorder";
        drag.targetDrawingId = null;
        drag.targetLayerId = null;
        drag.dropIndex = drop.toIndex;
        drag.rawIndex = drop.rawIndex;
        drag.fromIndex = drop.fromIndex;
        updateLayerTransferTargetIndicator(null);
        updateLayerMergeTargetIndicator(null);
        updateLayerDropIndicator(drag.drawingId, drop.rawIndex, drop.toIndex, drop.fromIndex);
        return;
      }

      drag.targetMode = "none";
      drag.targetDrawingId = null;
      drag.targetLayerId = null;
      drag.dropIndex = -1;
      drag.rawIndex = -1;
      updateLayerTransferTargetIndicator(null);
      updateLayerMergeTargetIndicator(null);
      updateLayerDropIndicator(drag.drawingId, -1, -1, drag.fromIndex);
    }
  }

  const layerSettingsDrag = state.layerSettingsPointerDrag;
  if (layerSettingsDrag && event.pointerId === layerSettingsDrag.pointerId) {
    const drop =
      layerSettingsDrag.type === "drawing"
        ? layerSettingsDrawingDropPosition(event.clientY, layerSettingsDrag.drawingId)
        : layerSettingsLayerDropPosition(event.clientY, layerSettingsDrag.layerId, layerSettingsDrag.drawingId);
    layerSettingsDrag.dropIndex = drop.toIndex;
    layerSettingsDrag.rawIndex = drop.rawIndex;
    layerSettingsDrag.fromIndex = drop.fromIndex;
    if (layerSettingsDrag.type === "drawing") {
      updateLayerSettingsDrawingDropIndicator(drop.rawIndex, drop.toIndex, drop.fromIndex);
    } else {
      updateLayerSettingsLayerDropIndicator(layerSettingsDrag.drawingId, drop.rawIndex, drop.toIndex, drop.fromIndex);
    }
  }
});

window.addEventListener("pointerup", (event) => {
  const drag = state.leftPanelPointerDrag;
  if (drag && event.pointerId === drag.pointerId) {
    clearLeftPanelPointerDrag(true);
  }

  const layerSettingsDrag = state.layerSettingsPointerDrag;
  if (layerSettingsDrag && event.pointerId === layerSettingsDrag.pointerId) {
    clearLayerSettingsPointerDrag(true);
  }
});

window.addEventListener("pointercancel", (event) => {
  const drag = state.leftPanelPointerDrag;
  if (drag && event.pointerId === drag.pointerId) {
    clearLeftPanelPointerDrag(false);
  }

  const layerSettingsDrag = state.layerSettingsPointerDrag;
  if (layerSettingsDrag && event.pointerId === layerSettingsDrag.pointerId) {
    clearLayerSettingsPointerDrag(false);
  }
});

window.addEventListener("blur", () => {
  if (state.leftPanelPointerDrag) clearLeftPanelPointerDrag(false);
  if (state.layerSettingsPointerDrag) clearLayerSettingsPointerDrag(false);
});

window.addEventListener("keydown", (e) => {
  if (isSettingsMenuOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSettingsMenu();
    }
    return;
  }

  if (isRenderSettingsMenuOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeRenderSettingsMenu();
    }
    return;
  }

  if (isRenderBoxPropertiesModalOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeRenderBoxPropertiesModal();
    }
    return;
  }

  if (isLayerSettingsMenuOpen()) {
    if (e.key === "Escape" && state.layerSettingsPointerDrag) {
      e.preventDefault();
      clearLayerSettingsPointerDrag(false);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeLayerSettingsModal();
    }
    return;
  }

  if (e.key === "Escape" && state.leftPanelPointerDrag) {
    clearLeftPanelPointerDrag(false);
    return;
  }

  if (e.key === "Escape" && state.activeRenderId) {
    e.preventDefault();
    deactivateActiveRenderBox();
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
window.addEventListener("beforeunload", () => {
  stopRenderPopoutCloseMonitor();
  closeRenderPopoutChannel();
});

initializeRenderPopoutWindowFromSnapshot();
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
