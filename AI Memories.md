# AI Memories

> Rule for Codex: Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes. Use clear headings, preserve existing decisions unless they were replaced, keep the "Current Task" section updated while work is in progress, and move a task's final outcome into the permanent sections below only after the user has tested it and explicitly confirmed that it is complete.

## Project Snapshot

- Last updated: 2026-03-29
- Project type: small browser-based CAD/drawing editor
- Entry file: `index.html`
- Main logic file: `app.js`
- Main geometry dependency: `clipper2-ts`

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
- Boolean union is handled through `clipper2-ts`.
- Boolean subtraction is also handled through `clipper2-ts`.
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
- After moving selected geometry, the affected layer or layers are rebuilt again so intersections and merges stay correct.
- Hidden layers are not rendered.
- Locked layers do not accept edits.

## Dependency Notes

### `clipper2-ts`

- Installed through `npm`.
- Stored under `node_modules`.
- Used for polygon boolean union and subtraction through the Clipper integer `Paths64` pipeline.
- Current package file: `package.json`

## Working Agreement For Future Changes

- This file should describe the real current behavior of the app, not plans disguised as facts.
- When a feature changes the way the program works, update the relevant architecture or behavior section immediately.
- If a task is still in progress, track it only in the "Current Task" section until the user has tested it and confirmed it is complete.
- Before user confirmation, update only the "Progress" inside "Current Task" rather than moving unfinished work into the permanent sections.
- Once the user confirms the task is complete, move the lasting result into the permanent sections above and clear the task section.
- When bugs are identified, record them in a `Known Bugs` section placed above `Current Task`, and include both the current status and any progress or chosen next method for fixing them.
- The `Reference Only` folder is not part of the default startup reading context for new chats. Only inspect files in `Reference Only` when the user explicitly asks to look at a specific reference example or behavior from that folder.

## Known Bugs

### 1. Rotated Draft Plane Boolean Merge / Topology Bug

- Status: fixed in the active `clipper2-ts` geometry pipeline.
- Symptom: at non-zero draft-plane rotation, shapes that should merge can remain separate even when the draw itself succeeds and no runtime boolean error is thrown.
- Current diagnosis: the main failure was precision mismatch. The draft-plane rotation basis and the Clipper integer boundary were not guaranteed to live on the same decimal lattice, so rotated shared edges that should stay collinear could drift apart at the boolean boundary and refuse to merge.
- Chosen fix: keep the rotation basis decimals matched to Clipper.
- Implemented fix details:
  - A seeded lookup table covers the known whole-degree draft-plane rotations used by the wheel-step workplane flow.
  - The draft-plane rotation boundary routes canonical whole-degree angles through that table so `Draft <-> World` transforms reuse frozen `sin/cos` values instead of recalculating them each time.
  - Arbitrary non-LUT angles also quantize their `sin/cos` values onto the same decimal lattice as Clipper through the fallback `getRotationBasis(...)` path.
  - The rotated repro family was re-tested against the new precision boundary to confirm that matching basis decimals with Clipper decimals is the important fix.
- Progress toward the fix:
  - FIX: the durable bug fix is that the rotation basis decimals must match Clipper decimals. Both LUT and non-LUT `sin/cos` values now quantize onto the same `1e8` decimal lattice as the active Clipper boundary, so the transform basis and the boolean kernel no longer disagree about rotated shared edges.
  - Added a seeded `0..359` whole-degree lookup table in `app.js`.
  - The seeded whole-degree table currently stores the known plane-step `sin/cos` values rounded to `8` decimal places.
  - Whole-degree lookup tolerance is now intentionally loose enough to catch near-whole-degree angles re-derived from existing geometry, such as `atan2(...)` results coming back from aligned edges that were originally created on a seeded whole-degree plane.
  - The whole-degree lookup tolerance was later increased again so `getRotationBasis(...)` snaps more aggressively onto the LUT before falling back to direct trig for near-step angles.
  - `setDraftAngleBase(...)` now canonicalizes those near-whole-degree plane angles back onto the exact seeded whole-degree basis so both the plane state and the `Draft <-> World` transforms use the same table entry.
  - `rotatePoint(...)` now reuses that table whenever the requested angle matches a canonical whole-degree rotation step, so the existing `draftToWorldWithPlane(...)` and `worldToDraftWithPlane(...)` paths automatically use the frozen basis for those plane rotations.
  - The draw add commit path no longer does `push + rebuildLayerShapes(...)`; it now unions `state.draftShape.geometry` directly into the active layer on mouse-up and replaces the layer with the merged result.
  - `clipper2-ts` is now the active boolean backend, and the Clipper adapter boundary names the integer conversion path explicitly as `toClipperPoint64(...)`, `ringToClipperPath64(...)`, and `toClipperPaths64(...)` before calling `booleanOpWithPolyTree(...)`.
  - A direct repro showed that the real breakage point was `clipperDecimals = 6`: before quantization, rotated sub-edge contacts were still exactly collinear, but after rounding to `1e-6` world units they were no longer exactly on the same line, so Clipper would keep them as separate polygons.
  - The Clipper scale was increased to `Math.max(8, draftRotationLookupDecimals)`, which preserves the LUT-generated rotated coordinates through the integer conversion boundary closely enough for the failing rotated rectangle-on-base union repro to merge into a single polygon again.
  - A direct comparison across four combinations on the same rotated repro showed:
    - `raw trig + 1e6` can partially merge but is not reliable;
    - `LUT + 1e6` fails badly because the `8`-decimal LUT basis is being cut again at `1e6`;
    - `raw trig + 1e8` is still not fully reliable on the larger multi-contact repro, because independently rounded irrational coordinates do not stay exactly collinear as integer sub-edges;
    - `LUT + 1e8` is the first combination that consistently merged the tested rotated whole-degree repros into a single polygon.
  - Arbitrary derived directions are now also quantized through the non-LUT fallback in `getRotationBasis(...)`, so they no longer mix raw trig output with a snapped Clipper boundary.
  - The user confirmed this direction as the bug fix to keep in memory.

## Current Task

- No active in-progress task is recorded right now.
