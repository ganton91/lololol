# AI Memories

> Rule for Codex: Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes. Use clear headings, preserve existing decisions unless they were replaced, keep the "Current Task" section updated while work is in progress, and move a task's final outcome into the permanent sections below only after the user has tested it and explicitly confirmed that it is complete.

## Project Snapshot

- Last updated: 2026-03-27
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
- There is no raster-mask union pipeline anymore.
- Each visible layer is drawn from its current merged vector shapes.
- Selection highlighting is drawn by tracing the selected shape geometry.

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
- `Select`: selects and moves whole merged shapes.
- `Mouse wheel`: zooms at cursor position.
- `Middle mouse` or `right mouse` outside draw mode: pans the camera.
- Holding `Space` enters a drafting-transforms mode without switching away from `Draw` or `Select`.
- `Space + mouse wheel`: rotates the drafting angle around the current workplane origin.
- `Space + middle drag`: moves the current workplane origin while the canvas stays fixed and the world shifts underneath.
- `Space + left drag`: aligns the workplane from a start point toward a dragged direction, with magnetic snap to nearby geometry plus free placement anywhere in space.

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
- While `Space` is held, the normal draw/select interaction is temporarily suspended and the pointer is used for drafting transformations instead.
- `Space + Left Drag` workplane alignment can start and end anywhere in space, but nearby geometry acts like a magnetic snap target.
- During `Space + Left Drag`, corners can capture from slightly farther away than edges, and corner snaps use a different preview marker from edge snaps.
- During `Space + Left Drag`, if there is no nearby geometry, the preview and resulting alignment still use the free pointer position instead of forcing a snap.
- Releasing `Space` during a pending workplane alignment cancels that alignment and returns control to the underlying tool.
- The toolbar shows a live workplane status readout with the current plane mode, rotation in degrees, and origin coordinates.
- Right click in `Draw` uses the current shape mode as subtraction geometry and applies boolean difference against the active layer's merged vector geometry.
- After drawing, the new geometry is inserted into the layer and the layer is rebuilt through boolean union.
- After subtractive drawing, the active layer is replaced with the resulting difference geometry instead of deleting whole merged objects by hit-test.
- After moving a selected shape, the layer is rebuilt again so intersections and merges stay correct.
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

## Current Task

- Task: Fix workplane rotation drift that creates post-rotate drawing seams
- Status: In progress
- Progress: The immediate focus has changed from measurement-system discussion to a workplane rotation correctness fix. Current investigation indicates that rotating the draft plane away from `0deg` and then back to `0deg` can leave a tiny residual angle because wheel rotation accumulates floating-point radians instead of returning to a canonical exact step state. That residual drift causes later grid-snapped drawing to land on a slightly different world lattice, which in turn creates visible seams between strokes that should share exact edges. The safest planned fix is to redesign workplane rotation state around canonical discrete rotation steps so returning to the prior angle restores the exact same plane instead of an approximate float-near-zero angle.
