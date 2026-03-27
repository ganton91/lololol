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

- `index.html` contains the canvas, toolbar, zoom controls, hint area, and layers panel.
- `app.js` reads those DOM elements and drives the whole interaction loop.
- The app still runs as a plain browser project without a bundler.

### Geometry Model

- The app is now vector-based.
- Shapes are stored as polygon or multipolygon geometry, not as primitive compounds.
- Square brush strokes are built from accumulated square polygon dabs and then stored like any other merged polygon geometry.
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
- The world origin is visualized with dedicated X=0 and Y=0 axis lines that cross at 0,0.
- The visible grid stays screen-aligned even when the drafting angle changes.
- World content is rendered through a global drafting/workplane rotation around `0,0`, so stored geometry stays in world coordinates while the user can draw against a rotated drafting frame.
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
- `Select`: selects and moves whole merged shapes.
- `Mouse wheel`: zooms at cursor position.
- `Space + drag` or middle/right mouse: pans the camera.
- `Space + mouse wheel`: rotates the drafting angle around the world origin `0,0`.

### Current Behavioral Rules

- New geometry is created on the active layer.
- `Rectangle` snapping is active on the visible drafting grid: rectangle draw and right-click subtract snap both corners to grid intersections, show a snap preview marker at the cursor, and produce bounds aligned exactly to cell multiples.
- Square Brush accumulates live vector draft geometry while dragging and commits the final stroke into the active layer on pointer release.
- Zoom is currently clamped between a minimum of `0.09` and a maximum of `2`.
- The app maintains a global drafting angle separate from stored geometry.
- Existing geometry is displayed relative to the current drafting angle, while the visible grid remains horizontal and vertical on screen.
- New drawing input is created in drafting coordinates and converted back into world geometry before boolean union with the layer.
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

## Current Task

- Task: Refine `Square Brush` stroke construction so recorded brush paths produce cleaner vector geometry and support the remaining brush-related interaction work.
- Status: In progress
- Progress: Rectangle snapping has been implemented, browser-tested, and confirmed by the user. The first snapping pass for `Stroke Rect` and `Ellipse` is still present in code and still waiting for browser validation before it moves into the permanent sections. Focus has now shifted to `Square Brush`: the previous brush pipeline stamps axis-aligned square dabs along the draft path, which creates staircase edges on diagonal or curved strokes. One intermediate brush attempt that used path-aligned strip segments was rejected because it no longer behaved like a true square brush. The brush geometry is now back on a square-sweep path, and an initial snapping pass is now in progress for `Square Brush`: its size control is expressed in whole grid cells, the pointer is centered on the brush preview, odd cell widths snap the brush center to cell centers, even cell widths snap the brush center to grid intersections, and the recorded brush path is now intended to advance from snapped center point to snapped center point. This still needs browser validation before it is moved into the permanent sections.
