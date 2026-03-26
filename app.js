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
  pointerInCanvas: false,
  spacePressed: false,
  start: { x: 0, y: 0 },
  current: { x: 0, y: 0 },
  draftStart: { x: 0, y: 0 },
  draftCurrent: { x: 0, y: 0 },
  panStart: { x: 0, y: 0 },
  panOrigin: { x: 0, y: 0 },
  drawSize: 24,
  stripCellWidth: 1,
  draftShape: null,
  brushLastPoint: null,
  drawOperation: "add",
  draftAngle: 0,
  camera: { x: 0, y: 0, zoom: 1 },
  selection: {
    shapeId: null,
    startWorld: null,
    shapeSnapshot: null,
    modified: false,
  },
};

const outlineStrokeColor = "#0f172a";
const selectionStrokeColor = "#0ea5e9";
const previewStrokeColor = "#0284c7";
const previewStrokeWidth = 1.5;
const minZoom = 0.09;
const maxZoom = 2;
const ellipseSegments = 96;
const squareBrushSpacingRatio = 0.35;
const draftRotationStep = Math.PI / 36;
const gridCellSize = 24;
const gridMidCellInterval = 10;
const gridMajorCellInterval = 20;
const snapPreviewSize = 8;
const layerPalette = ["#93c5fd", "#86efac", "#fca5a5", "#fde68a", "#c4b5fd", "#fdba74", "#67e8f9"];

function updateZoomLabel() {
  zoomLevel.textContent = Math.round(state.camera.zoom * 100) + "%";
}

function updateCursor() {
  if (state.panning || state.spacePressed) {
    canvas.style.cursor = "grab";
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
    drawSizeInput.min = "2";
    drawSizeInput.max = "300";
    drawSizeInput.step = "1";
    drawSizeInput.value = String(Math.round(state.drawSize));
    drawSizeInput.title = "Square Brush size";
    drawSizeInput.setAttribute("aria-label", "Square Brush size");
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

function getDraftInputPoint(point, shapeType = state.shapeType) {
  if (isBoxSnapShapeType(shapeType)) return snapDraftPointToGrid(point);
  return { x: point.x, y: point.y };
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

function unionGeometryList(geometries) {
  const cleanGeometries = [];

  for (const geometry of geometries) {
    const cleanGeometry = sanitizeGeometry(geometry);
    if (cleanGeometry.length) cleanGeometries.push(cleanGeometry);
  }

  if (!cleanGeometries.length) return [];
  if (cleanGeometries.length === 1) return deepCopyGeometry(cleanGeometries[0]);

  return sanitizeGeometry(polygonBoolean.union(cleanGeometries[0], ...cleanGeometries.slice(1)));
}

function differenceGeometry(subjectGeometry, clipGeometry) {
  const cleanSubject = sanitizeGeometry(subjectGeometry);
  const cleanClip = sanitizeGeometry(clipGeometry);

  if (!cleanSubject.length) return [];
  if (!cleanClip.length) return deepCopyGeometry(cleanSubject);

  return sanitizeGeometry(polygonBoolean.difference(cleanSubject, cleanClip));
}

function worldToDraft(point) {
  return rotatePoint(point, -state.draftAngle);
}

function draftToWorld(point) {
  return rotatePoint(point, state.draftAngle);
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
  const side = Math.max(2, size);
  const half = side / 2;
  return createRectGeometry({
    x: point.x - half,
    y: point.y - half,
    w: side,
    h: side,
  });
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
}

function startSquareBrushStroke(point) {
  state.brushLastPoint = { x: point.x, y: point.y };
  setDraftShapeFromGeometry(draftGeometryToWorld(createSquareBrushDabGeometry(point, state.drawSize)));
}

function extendSquareBrushStroke(point) {
  if (!state.brushLastPoint) {
    startSquareBrushStroke(point);
    return;
  }

  const dx = point.x - state.brushLastPoint.x;
  const dy = point.y - state.brushLastPoint.y;
  const distance = Math.hypot(dx, dy);
  const spacing = Math.max(1, state.drawSize * squareBrushSpacingRatio);
  const dabs = [];
  const steps = Math.max(1, Math.ceil(distance / spacing));

  for (let i = 1; i <= steps; i += 1) {
    const t = distance ? i / steps : 1;
    dabs.push(
      draftGeometryToWorld(
        createSquareBrushDabGeometry(
          {
            x: state.brushLastPoint.x + dx * t,
            y: state.brushLastPoint.y + dy * t,
          },
          state.drawSize
        )
      )
    );
  }

  const geometry = unionGeometryList([state.draftShape ? state.draftShape.geometry : [], ...dabs]);
  state.brushLastPoint = { x: point.x, y: point.y };
  setDraftShapeFromGeometry(geometry);
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
  return createLayerShapeRecordsFromGeometry(layerId, unionGeometryList(sourceShapes.map((shape) => shape.geometry)));
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

  const selectedShape = state.shapes.find((shape) => shape.id === state.selection.shapeId) || null;
  const affectsSelection = selectedShape && selectedShape.layerId === layerId;
  const nextGeometry = differenceGeometry(
    unionGeometryList(layerShapes.map((shape) => shape.geometry)),
    subtractionGeometry
  );

  replaceLayerShapes(layerId, createLayerShapeRecordsFromGeometry(layerId, nextGeometry));

  if (affectsSelection) clearSelection();
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

function clearSelection() {
  state.selection.shapeId = null;
  state.selection.startWorld = null;
  state.selection.shapeSnapshot = null;
  state.selection.modified = false;
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
  state.tool = tool;
  selectBtn.classList.toggle("active", tool === "select");
  drawBtn.classList.toggle("active", tool === "draw");
  if (tool !== "draw") resetDrawSession();
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
  targetCtx.translate(state.camera.x, state.camera.y);
  targetCtx.scale(state.camera.zoom, state.camera.zoom);
  targetCtx.rotate(-state.draftAngle);
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

function rotateDraftAngle(deltaAngle) {
  state.draftAngle = normalizeAngle(state.draftAngle + deltaAngle);
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

function renderSelectOverlay() {
  if (state.tool !== "select" || !state.selection.shapeId) return;

  const selectedShape = state.shapes.find((shape) => shape.id === state.selection.shapeId);
  if (!selectedShape) return;

  const selectedLayer = getLayerById(selectedShape.layerId);
  if (!selectedLayer || !selectedLayer.visible) return;

  ctx.save();
  applyWorldCameraTransform(ctx);
  ctx.beginPath();
  traceGeometryPath(ctx, selectedShape.geometry);
  ctx.strokeStyle = selectionStrokeColor;
  ctx.lineWidth = 2 / state.camera.zoom;
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

function drawSnapPreview() {
  if (!state.pointerInCanvas || state.panning || state.spacePressed) return;
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
  }

  if (!snapPoint) return;

  const screenPoint = draftToScreen(snapPoint);
  const size = snapPreviewSize;
  const isSubtract = state.dragging && state.drawOperation === "subtract";

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
  drawSnapPreview();
}

canvas.addEventListener("pointerdown", (e) => {
  const screen = getPos(e);
  const rawDraft = screenToDraft(screen);
  const draft = state.tool === "draw" ? getDraftInputPoint(rawDraft) : rawDraft;
  const world = draftToWorld(draft);
  state.pointerInCanvas = true;
  state.current = world;
  state.draftCurrent = draft;
  const wantsPan = e.button === 1 || state.spacePressed || (e.button === 2 && state.tool !== "draw");

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
    if (!pick) {
      clearSelection();
      render();
      return;
    }

    state.selection.shapeId = state.shapes[pick.shapeIndex].id;
    state.selection.startWorld = world;
    state.selection.shapeSnapshot = cloneShape(state.shapes[pick.shapeIndex]);
    state.selection.modified = false;
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
      startSquareBrushStroke(draft);
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
  const rawDraft = screenToDraft(screen);
  state.pointerInCanvas = true;
  state.draftCurrent = state.tool === "draw" ? getDraftInputPoint(rawDraft) : rawDraft;
  state.current = draftToWorld(state.draftCurrent);

  if (state.panning) {
    state.camera.x = state.panOrigin.x + (screen.x - state.panStart.x);
    state.camera.y = state.panOrigin.y + (screen.y - state.panStart.y);
    render();
    return;
  }

  if (!state.dragging) {
    render();
    return;
  }

  if (state.tool === "select") {
    const shapeIndex = state.shapes.findIndex((shape) => shape.id === state.selection.shapeId);
    if (shapeIndex >= 0 && state.selection.shapeSnapshot && state.selection.startWorld) {
      const dx = state.current.x - state.selection.startWorld.x;
      const dy = state.current.y - state.selection.startWorld.y;
      const didChange = Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6;
      const nextShape = cloneShape(state.selection.shapeSnapshot);
      moveShapeBy(nextShape, dx, dy);
      state.shapes[shapeIndex] = nextShape;
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

function finishDrag() {
  if (state.panning) {
    state.panning = false;
    updateCursor();
    render();
    return;
  }

  if (!state.dragging) return;

  if (state.tool === "select") {
    const selectedShape = state.shapes.find((shape) => shape.id === state.selection.shapeId) || null;
    const selectedLayerId = selectedShape ? selectedShape.layerId : null;
    const needsUnionRefresh = state.selection.modified && selectedLayerId;

    state.selection.startWorld = null;
    state.selection.shapeSnapshot = null;
    state.selection.modified = false;
    state.dragging = false;

    if (needsUnionRefresh) {
      rebuildLayerShapes(selectedLayerId);
      const pickedShape = pickShapeInLayerAt(selectedLayerId, state.current);
      state.selection.shapeId = pickedShape ? pickedShape.id : null;
    }

    render();
    return;
  }

  if (state.tool === "draw") {
    if (state.draftShape && !state.draftShape.small) {
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
      rotateDraftAngle(e.deltaY < 0 ? draftRotationStep : -draftRotationStep);
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
    state.drawSize = Math.max(2, Math.min(300, value));
    drawSizeInput.value = String(Math.round(state.drawSize));
  } else {
    return;
  }

  if (state.dragging && state.tool === "draw") {
    if (!isSquareBrushShapeType()) {
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
  if (e.key.toLowerCase() === "s") setTool("select");
  if (e.key.toLowerCase() === "d") setTool("draw");
  if (e.code === "Space") {
    e.preventDefault();
    state.spacePressed = true;
    updateCursor();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    state.spacePressed = false;
    updateCursor();
  }
});

window.addEventListener("resize", resizeCanvas);

updateZoomLabel();
updateCursor();
renderLayersPanel();
syncDrawSizeInput();
resizeCanvas();
