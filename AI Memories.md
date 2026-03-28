# AI Memories

> Rule for Codex: Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes. Use clear headings, preserve existing decisions unless they were replaced, keep the "Current Task" section updated while work is in progress, and move a task's final outcome into the permanent sections below only after the user has tested it and explicitly confirmed that it is complete.

## Project Snapshot

- Last updated: 2026-03-29
- Project type: small browser-based CAD/drawing editor
- Entry file: `index.html`
- Main logic file: `app.js`
- Main geometry dependency: `polygon-clipping`

## What The Application Currently Is

This application is a single-page 2D vector drawing tool that opens directly from `index.html` in the browser. The UI is defined in `index.html`, while the application logic lives in `app.js`.

The editor supports drawing, selecting, moving, erasing, zooming, panning, and layer management. Every new shape drawn into a layer is merged into that layer with boolean union logic.

## Current Architecture

### UI Structure

- `index.html` contains the canvas, toolbar, zoom controls, live workplane status readout, hint area, and layers panel.
- `app.js` reads those DOM elements and drives the whole interaction loop.
- The app still runs as a plain browser project without a bundler.

### Geometry Model

- The app is now vector-based.
- Shapes are stored as polygon or multipolygon geometry, not as primitive compounds.
- Square brush strokes are built from unions of exact square-sweep segment hulls in draft space and then stored like any other merged polygon geometry.
- A shape record currently stores:
  - `id`
  - `layerId`
  - `geometry`
  - `bounds`
- Boolean union is handled through `polygon-clipping`.
- Boolean subtraction is also handled through `polygon-clipping.difference`.
- Layer geometry is rebuilt by unioning the shapes that belong to the layer.

### Important Geometry Note

- Ellipses are currently represented as polygon approximations, not as exact analytic ellipse entities.
- This means the app is fully vector-based, but it is a polygon vector pipeline, not a curve-kernel CAD engine.
- This is good for clean boolean union behavior now, but it may need a future architectural upgrade if the project later requires exact curved elevations, sections, exports, or CAD-grade curve persistence.

### Rendering Model

- Rendering is direct vector drawing on the main canvas.
- The canvas background grid uses three line tiers: minor lines every cell, mid lines every 10 cells, and major lines every 20 cells.
- The active workplane origin is visualized with dedicated draft X=0 and Y=0 axis lines.
- The visible grid stays screen-aligned even when the drafting angle changes.
- World content is rendered through a drafting/workplane transform with both `origin` and `angle`, so stored geometry stays in world coordinates while the user can draw against a translated and rotated drafting frame.
- Wheel-based draft-plane rotation is now canonical instead of accumulated: the workplane keeps a normalized base angle plus an integer wheel-step offset, so rotating away and back returns to the same exact plane instead of a float-near-zero residual angle.
- There is no raster-mask union pipeline anymore.
- Each visible layer is drawn from its current merged vector shapes.
- Selection highlighting is drawn by tracing the selected shape geometries.

### Layer Model

Each layer currently has:

- `id`
- `name`
- `visible`
- `locked`
- `fillColor`

Layer order controls draw order. The active layer receives new geometry when the user draws.

### Tools And Interaction

- `Draw`: creates rectangle, ellipse, strip, or square-brush geometry with left click, and subtracts with the same geometry modes using right click.
- `Draw` size controls for `Stroke Rect` and `Square Brush` are expressed in whole visible grid cells.
- `Select`: selects and moves one or more whole merged shapes.
- `S`: switches to `Select`.
- Pressing `Escape` while `Draw` is active switches to `Select`.
- `Mouse wheel`: zooms at cursor position.
- `Middle mouse` or `right mouse` outside draw mode: pans the camera.
- Holding `Space` enters a drafting-transforms mode without switching away from `Draw` or `Select`.
- `Space + mouse wheel`: rotates the drafting angle around the current workplane origin in exact `1deg` step positions.
- `Space + middle drag`: moves the current workplane origin while the canvas stays fixed and the world shifts underneath.
- `Space + left drag`: aligns the workplane from a start point toward a dragged direction, with magnetic snap to nearby geometry plus free placement anywhere in space.
- `Space + R`: resets the workplane back to the world plane by restoring origin `0,0` and rotation `0deg`.

### Current Behavioral Rules

- New geometry is created on the active layer.
- `Rectangle` and `Ellipse` snapping are active on the visible drafting grid: draw and right-click subtract snap both bounding-box corners to grid intersections, show a snap preview marker at the cursor, and produce bounds aligned exactly to cell multiples.
- `Stroke Rect` width is expressed in whole grid cells, its generated strip width is always an exact multiple of one cell, and its centerline snapping is parity-aware: odd cell widths snap on half-cell centerline families while even cell widths snap on full grid intersections.
- `Stroke Rect` can be drawn at arbitrary drafting angles while preserving its cell-multiple width and parity-aware snapping.
- `Stroke Rect` supports sticky `Shift` axis lock behavior during an active draw: holding `Shift` constrains the strip direction to the draft-space `X` or `Y` axis for the current hold.
- `Square Brush` size is expressed in whole grid cells and its preview is centered on the snapped pointer position.
- `Square Brush` snapping is parity-aware: odd cell widths snap the brush center to cell centers, while even cell widths snap the brush center to grid intersections.
- `Square Brush` records and rebuilds its path from snapped center point to snapped center point, using square-sweep geometry instead of dab-by-dab stamping.
- `Square Brush` supports reference-style `Shift` axis lock behavior: pressing `Shift` during an active stroke resets the lock anchor to the current pointer position, the lock direction is chosen from client-space movement, and the chosen axis stays sticky until `Shift` is released.
- `Square Brush` remembers the previous brush point between strokes, so starting a new square-brush stroke with `Shift` can continue immediately from that remembered point.
- Square Brush accumulates live vector draft geometry while dragging and commits the final stroke into the active layer on pointer release.
- Zoom is currently clamped between a minimum of `0.09` and a maximum of `2`.
- The app maintains a workplane with separate `origin` and `angle`, independent from stored geometry.
- Existing geometry is displayed relative to the current workplane, while the visible grid remains horizontal and vertical on screen.
- New drawing input is created in drafting coordinates relative to the current workplane and converted back into world geometry before boolean union with the layer.
- Wheel-based workplane rotation no longer accumulates float angle drift: returning by the same number of wheel steps restores the exact same derived plane angle, which prevents post-rotate seams caused by near-zero residual rotation.
- While `Space` is held, the normal draw/select interaction is temporarily suspended and the pointer is used for drafting transformations instead.
- `Space + Left Drag` workplane alignment can start and end anywhere in space, but nearby geometry acts like a magnetic snap target.
- During `Space + Left Drag`, corners can capture from slightly farther away than edges, and corner snaps use a different preview marker from edge snaps.
- During `Space + Left Drag`, if there is no nearby geometry, the preview and resulting alignment still use the free pointer position instead of forcing a snap.
- Pressing `R` while `Space` is held resets the current workplane to the world-aligned plane, cancels any in-progress draft transform drag, and leaves drafting-transforms mode active as long as `Space` remains held.
- Releasing `Space` during a pending workplane alignment cancels that alignment and returns control to the underlying tool.
- The toolbar shows a live workplane status readout with the current plane mode, rotation in degrees, and origin coordinates.
- `Select` supports marquee selection in draft/screen space: dragging right selects only shapes fully enclosed by the box, while dragging left selects shapes that are enclosed by or intersect the box.
- Holding `Shift` in `Select` toggles selection membership for both click and marquee selection: newly hit shapes are added while already selected shapes captured by the click or box are removed.
- Multi-selected shapes move together when dragged from a selected shape.
- Pressing `Escape` while in `Select` with an active selection clears that selection.
- Right click in `Draw` uses the current shape mode as subtraction geometry and applies boolean difference against the active layer's merged vector geometry.
- After drawing, the new geometry is inserted into the layer and the layer is rebuilt through boolean union.
- After subtractive drawing, the active layer is replaced with the resulting difference geometry instead of deleting whole merged objects by hit-test.
- Boolean union and difference still try the collinear-overlap `preSplit` path first, but if that processed path fails and the equivalent raw boolean succeeds, the app now falls back to the raw result while keeping the regression diagnostics.
- When a two-shape union succeeds but still returns multiple polygons because the shapes only share a collinear edge, the app now attempts a narrow shared-edge stitch fallback for simple exterior-ring cases and keeps the non-merge diagnostics whether that stitch succeeds or not.
- After moving selected geometry, the affected layer or layers are rebuilt again so intersections and merges stay correct.
- Hidden layers are not rendered.
- Locked layers do not accept edits.

## Dependency Notes

### `polygon-clipping`

- Installed through `npm`.
- Stored under `node_modules`.
- Used for polygon boolean union.
- Current package file: `package.json`

## Working Agreement For Future Changes

- This file should describe the real current behavior of the app, not plans disguised as facts.
- When a feature changes the way the program works, update the relevant architecture or behavior section immediately.
- If a task is still in progress, track it only in the "Current Task" section until the user has tested it and confirmed it is complete.
- Before user confirmation, update only the "Progress" inside "Current Task" rather than moving unfinished work into the permanent sections.
- Once the user confirms the task is complete, move the lasting result into the permanent sections above and clear the task section.
- The `Reference Only` folder is not part of the default startup reading context for new chats. Only inspect files in `Reference Only` when the user explicitly asks to look at a specific reference example or behavior from that folder.

## Known Bugs

### Intermittent Layer Rebuild Boolean Failure

- Status: currently not reproduced in the latest manual testing sessions, but still treated as a known latent bug rather than fully resolved.
- Symptom: during draw commits and layer rebuilds, `polygon-clipping` can throw during layer union rebuild, which breaks the rebuild. Before the cleanup guard was added, this could also leave the draft preview visually stuck.
- Scope observed so far: the crash happens inside `rebuildLayerShapes` during boolean union. It is not always caused by the most recently inserted shape; some failures narrow down to an existing pair of shapes already present in the layer.
- Key finding: the current collinear-overlap `preSplit` mitigation changes the boolean inputs before union. In some cases this makes failures rarer, but in other cases the raw pair unions successfully while the pre-split processed pair fails, so the mitigation can also introduce a regression.
- Debug and mitigation work completed so far:
  - Added a live debug status line plus stage-specific logs for `finishDrag`, `insertShapeToLayer`, `rebuildLayerShapes`, `subtractGeometryFromLayer`, and uncaught runtime errors.
  - Added global debug payloads on `window.__cadDebugLastBooleanFailure`, `window.__cadDebugLastUnion`, and `window.__cadDebugLastDifference`.
  - Added focused failure helpers on `window.__cadDebugLastUnionFocus`, `window.__cadDebugLastBooleanFailureFocus`, `window.__cadDebugLastUnionPairSnapshot`, `window.__cadDebugLastBooleanFailurePairSnapshot`, `window.__cadDebugLastUnionRegression`, and `window.__cadDebugLastBooleanFailureRegression`.
  - Added a successful-non-merge diagnostic on `window.__cadDebugLastUnionNonMerge` / `window.__cadDebugLastBooleanNonMerge` for the case where union succeeds but still returns multiple polygons, so gap/corner-touch cases can be distinguished from pre-split topology regressions.
  - Added pairwise analysis, minimal failing subset isolation, exact split-point capture, SVG snapshots, and per-geometry integrity diagnostics for failing boolean cases.
  - Added a cleanup path in `finishDrag` so a boolean/runtime failure no longer leaves the draft preview stuck from the exception alone.
  - Added a conservative runtime fallback for boolean union/difference: if the pre-split processed inputs fail but the equivalent raw inputs succeed, the app now returns the raw boolean result instead of breaking the commit, while preserving the regression snapshot for later inspection.
  - Added a narrow shared-edge stitch fallback for two simple exterior-ring union inputs: when union succeeds but leaves a `shared-collinear-edge-without-merge` result, the app removes the duplicated internal edge, rebuilds the outer loop, and accepts it only if XOR validation proves it is area-equivalent to the original union result.
  - Tried an experimental incremental union rebuild earlier and then backed it out because it introduced noisier failure modes; the layer rebuild is back to a direct union of source geometries.
- Recommended future follow-up if this bug reappears:
  - Inspect the union focus, pair snapshot, and regression globals first.
  - Treat the current `preSplit` logic as a suspect, because the strongest recent repros show raw pair success and processed pair failure.
  - If needed, either narrow the `preSplit` logic to only safe overlap patterns or temporarily remove it to return to a pure debug-only baseline.

## Current Task

- Goal: validate the new conservative boolean fallback that recovers with raw inputs when the `preSplit` path regresses.
- Status: in progress.
- Progress: `unionGeometryList` and `differenceGeometry` now retry the equivalent raw boolean only after a processed pre-split failure. If the raw attempt succeeds, the app keeps the debug payloads and regression snapshots but returns the raw result so draw/subtract commits can continue instead of failing outright. A second diagnostic branch now captures successful-but-unmerged two-shape unions so we can tell apart true gap/corner-touch cases from silent pre-split topology changes, and a new narrow stitch fallback tries to collapse `shared-collinear-edge-without-merge` results into a single polygon for simple two-ring cases after XOR validation. Manual browser validation is still pending.
