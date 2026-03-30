# AI Memories

> Rule for Codex: Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes. Use clear headings, preserve existing decisions unless they were replaced, keep the "Current Task" section updated while work is in progress, and move a task's final outcome into the permanent sections below only after the user has tested it and explicitly confirmed that it is complete.

## Project Snapshot

- Last updated: 2026-03-31
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
- The preferred project direction is to remain compatible with plain browser deployment through native ES modules and static hosting (for example GitHub Pages or similar simple web hosting) without requiring a build step just to run the app.

### Geometry Model

- The app is now vector-based.
- Shapes are stored as polygon or multipolygon geometry, not as primitive compounds.
- Square brush strokes are built from unions of exact square-sweep segment hulls in draft space and then stored like any other merged polygon geometry.
- A shape record currently stores:
  - `id`
  - `layerId`
  - `geometry`
  - `bounds`
- Boolean union, subtraction, and overlap/intersection checks are handled through `clipper2-ts`.
- The boolean boundary is wrapped by an in-file Clipper adapter layer that preserves the app's nested `[[outer, hole1...]]` multipolygon model.
- The Clipper adapter uses fixed precision integer scaling with a shared `8`-decimal coordinate policy.
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
- Wheel-based draft-plane rotation is now canonical instead of accumulated: the workplane tracks a canonical angle family/candidate plus integer step identity, so rotating away and back returns to the same exact plane coefficients instead of a float-near-zero residual angle.
- Trig-generated workplane coordinates and the Clipper adapter now share the same `8`-decimal quantization policy, so rotated world-space geometry enters boolean operations on the same canonical coordinate grid.
- There is no raster-mask union pipeline anymore.
- Each visible layer is drawn from its current merged vector shapes.
- Visible layer shapes also render small black vertex markers at each stored polygon vertex.
- Selection highlighting is drawn by tracing the selected shape geometries.

### Draft Angle Model

- Draft-angle logic is split between `draft-angle.js` for family/lookup-table construction and `app.js` for workplane runtime state.
- Family records are designed as serializable project data with `id`, `kind`, `baseAngleDeg`, optional normalized `baseVectorDx/baseVectorDy`, `stepDegrees`, and `stepCount`.
- The default canonical family covers `0..359` degree steps at `1deg` increments, and each lookup entry stores canonical `cos` and `sin` coefficients rounded to the shared `8`-decimal precision.
- The active workplane rotation is represented as `mode` (`family`, `candidate`, or fallback `free`) plus a family/base descriptor and integer `stepIndex`.
- Family-driven `draft -> world`, `world -> draft`, and world-content canvas rendering all read the active lookup entry's canonical coefficients instead of recomputing trig from a floating angle.
- `Align` can resolve into an existing known family or into a temporary unresolved candidate family derived from a normalized direction vector; candidate records and persistent dynamic families share the same 360-step lookup-table structure.
- A temporary candidate becomes a persistent dynamic family only when the user commits a real draw or subtract operation under that regime; otherwise it is discarded when the plane is reset or switched back into a known or already-persistent family.
- The browser console exposes a live registry view for persistent draft-angle families and logs detailed per-align debug vectors for comparing align input against stored family directions.

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
- `Space + mouse wheel`: rotates through the active draft-angle family or candidate around the current workplane origin in exact `1deg` integer step positions.
- `Space + middle drag`: moves the current workplane origin while the canvas stays fixed and the world shifts underneath.
- `Space + left drag`: aligns the workplane from a start point toward a dragged direction, with magnetic snap to nearby geometry plus free placement anywhere in space, and resolves that direction into either an existing family or a temporary candidate regime.
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
- The app maintains a workplane with separate `origin` and canonical draft-angle state, independent from stored geometry.
- Existing geometry is displayed relative to the current workplane, while the visible grid remains horizontal and vertical on screen.
- New drawing input is created in drafting coordinates relative to the current workplane and converted back into world geometry before boolean union with the layer.
- World-space vertices produced from rotated draft geometry are quantized to the same shared `8`-decimal precision used by the Clipper boolean boundary.
- `Space + wheel` mutates only the integer `stepIndex` of the active draft-angle family or candidate, so returning to a previous step reuses the exact same canonical lookup coefficients.
- Wheel-based workplane rotation no longer accumulates float angle drift: returning by the same number of wheel steps restores the exact same derived plane angle, which prevents post-rotate seams caused by near-zero residual rotation.
- Known-family transforms, candidate-family transforms, and world-content canvas rendering all use the same active canonical `cos/sin` coefficients.
- While `Space` is held, the normal draw/select interaction is temporarily suspended and the pointer is used for drafting transformations instead.
- `Space + Left Drag` workplane alignment can start and end anywhere in space, but nearby geometry acts like a magnetic snap target.
- During `Space + Left Drag`, corners can capture from slightly farther away than edges, and corner snaps use a different preview marker from edge snaps.
- During `Space + Left Drag`, if there is no nearby geometry, the preview and resulting alignment still use the free pointer position instead of forcing a snap.
- During `Space + Left Drag`, snapping affects only the chosen start/end points; the resulting alignment direction is always derived from the raw point-to-point `end - start` vector of those resolved endpoints.
- If an aligned direction matches a known family signature, the workplane re-enters that family; otherwise it activates or reuses a temporary unresolved candidate family for that direction regime.
- The first committed draw or subtract operation while a candidate family is active materializes it into a persistent dynamic family; resetting the plane or leaving that regime without a commit discards the temporary candidate.
- Pressing `R` while `Space` is held resets the current workplane to the world-aligned plane, cancels any in-progress draft transform drag, and leaves drafting-transforms mode active as long as `Space` remains held.
- Releasing `Space` during a pending workplane alignment cancels that alignment and returns control to the underlying tool.
- The toolbar shows a live workplane status readout with the current plane mode, rotation in degrees formatted to up to `15` decimal places, and origin coordinates.
- `Select` supports marquee selection in draft/screen space: dragging right selects only shapes fully enclosed by the box, while dragging left selects shapes that are enclosed by or intersect the box.
- Holding `Shift` in `Select` toggles selection membership for both click and marquee selection: newly hit shapes are added while already selected shapes captured by the click or box are removed.
- Multi-selected shapes move together when dragged from a selected shape.
- Pressing `Escape` while in `Select` with an active selection clears that selection.
- Right click in `Draw` uses the current shape mode as subtraction geometry and applies boolean difference against the active layer's merged vector geometry.
- After drawing, the new geometry is inserted into the layer and the layer is rebuilt through boolean union.
- After subtractive drawing, the active layer is replaced with the resulting difference geometry instead of deleting whole merged objects by hit-test.
- Before layer shapes are recreated, both boolean union results and subtractive difference results are passed through Clipper collinear simplification, so exact straight-line extra vertices can be removed from both additive and subtractive outcomes.
- After moving selected geometry, the affected layer or layers are rebuilt again so intersections and merges stay correct.
- Hidden layers are not rendered.
- Locked layers do not accept edits.

## Dependency Notes

### `clipper2-ts`

- Installed through `npm`.
- Stored under `node_modules`.
- Used for polygon boolean union, subtraction, and intersection/overlap checks.
- Used through an adapter layer in `app.js` that converts between the app's nested multipolygon geometry model and Clipper `Paths64` / `PolyTree64` structures.
- Uses fixed precision integer scaling with a shared `8`-decimal coordinate policy across both trig-generated geometry and boolean operations.
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

- Status: fixed and kept here only as historical record.
- Symptom: at non-zero draft-plane rotation, shapes that should merge can remain separate even when the draw itself succeeds and no runtime boolean error is thrown.
- Root cause: rotated draft-plane geometry was entering the world-space boolean pipeline with trig-based floating-point noise, so edges that should have matched exactly could arrive as near-matching coordinates instead of a single canonical edge.
- Fix that resolved it:
  - The app now uses `clipper2-ts` as the boolean engine through the Clipper adapter in `app.js`.
  - The Clipper boundary uses fixed precision scaling with a shared `8`-decimal coordinate policy.
  - `rotatePoint(...)` now rounds `Math.sin(...)` / `Math.cos(...)` to that same `8`-decimal precision and quantizes the rotated coordinates it returns.
  - Ellipse point generation uses that same `8`-decimal trig precision before geometry enters boolean operations.
- Result: the rotated draft-plane merge/topology failure is considered resolved.

## Current Task

- Task: design and build a reference-style `Renders` workspace for the current vector app. This replaces the old `Views` naming with `Renders` and must cover the render list panel, render box interaction on the main canvas, render tabs, render panes, render properties flows, exports, and optional pop-out window behavior.
- Status: scope and architecture are now defined from the reference project; no `Renders` UI or behavior has been implemented in the current app yet.

### Target Product Slice

- Add a panel named `Renders` modeled after the reference project's `Views` panel.
- Each render entry should represent a saved render setup, not just a temporary preview.
- The active render should own a world-space render box that is visible on the main canvas.
- The render box should behave like the reference view box: selectable, movable, and resizable from normal editing/select interaction rather than being hidden in a separate mode.
- The application should have a bottom tab switcher with `Main Canvas` plus named render tabs such as `Render 1`, `Render 2`, and so on.
- `Main Canvas` remains the drafting/editing environment.
- A render tab opens a dedicated render workspace for that saved render, following the reference pattern rather than replacing the main drawing canvas.

### Planned Render Workspace UX

- The `Renders` panel should follow the same general structure as the reference:
  - saved render list
  - active render selection
  - per-render actions
- Each render entry is expected to expose reference-style actions, with current naming direction:
  - `Layer Properties`
  - `Render Properties`
  - `Render Box Properties` or equivalent final label
- `Layer Properties` should be the place where the render config controls how global layers participate inside that render.
- `Render Properties` should hold render-level output settings and workspace settings.
- `Render Box Properties` should hold properties tied to the render box / cut setup, such as section axes, plan height, and related box-scoped documentation settings.
- A render tab should open a render output workspace similar to the reference multi-pane area rather than just a single flat preview.
- The workspace should support reference-style pane layout logic and pane direction selection instead of hard-coding a single output view.
- `Open in New Window` should be supported for the active render tab using the same reference-style pop-out model.

### Main Canvas Interaction Requirements

- Render boxes must exist in the same world-space environment as the normal drawing content.
- In `Select` mode, the user should be able to pick an active render box directly on the main canvas.
- The active render box should support move behavior.
- The active render box should support resize behavior.
- The render box should remain part of the main-canvas editing context even when the user later switches to a render tab for output review.
- Render box interaction should follow the reference mental model, where the saved render owns bounds and the bounds can be edited graphically.

### Data Model Direction

- Layers are expected to become global application data for the render system, rather than being duplicated per render.
- Each render should store its own render-scoped configuration that references global layers.
- Current working render record direction:
  - `id`
  - `name`
  - `visible`
  - `bounds` for the render box
  - render-local layer configs keyed by global layer id
  - render-local layer order
  - render-local section / cut definitions
  - pane directions and pane layout
  - pane viewport metadata for fit / zoom / pan
- Runtime-only pop-out window state should stay separate from the saved render document data, following the reference split between saved view state and pop-out synchronization state.

### Rendering Architecture Direction

- The new render system should stay vector-first before final panel rasterization, matching the reference project's documentation/projection approach.
- The source model should remain the app's merged world-space multipolygon geometry plus vertical metadata.
- Each participating layer should behave as a `2.5D` footprint extrusion span, not as a true solid model.
- For a render, the engine should:
  - clip layer geometry against the render box
  - project it into render-local documentation geometry
  - resolve plan / elevation / section logic against that projected representation
- The projected documentation geometry should be the shared source for:
  - panel drawing
  - DXF export
  - high-resolution PNG export
  - PDF export
- Final on-screen pane drawing may still rasterize at the last stage, but only after the vector-first projected result has already been built.

### Crisp Pane Rendering Requirements

- The render panes should match the reference pane behavior as closely as practical.
- Each pane should auto-fit content once based on projected content bounds and the available panel surface.
- Each pane should render into a device-pixel aware backing canvas.
- Each pane should render with `imageSmoothingEnabled = false`.
- Each pane should support an oversampled backing resolution budget so later pane zoom remains crisp.
- Pane zoom and pan should be applied as CSS transform on the pane canvas rather than forcing a full re-render on every wheel or drag event.
- Pane viewport metadata should store at least the panel surface size and maximum safe zoom budget, following the reference fit-and-transform pattern.

### Tabs, Pop-Out, And Workspace Logic To Mirror

- The lower tab strip should work like the reference `Main View` plus named saved view buttons, but renamed around `Main Canvas` and `Renders`.
- Switching from `Main Canvas` to a render tab should activate that saved render workspace rather than changing the underlying source geometry.
- A render opened in a separate window should behave like the reference pop-out flow:
  - the active render tab can be opened in a dedicated window
  - the main window should know when that external window is open
  - the main workspace should be able to focus or close the external render window
  - the pop-out window should mirror the render workspace for that render rather than booting an unrelated stripped-down page
- The reference uses a snapshot-plus-sync model for the pop-out window; the new render system should follow that pattern rather than inventing a completely different window architecture.

### Reference Research Conclusions Already Locked In

- The reference project stores vertical mass through per-view layer config using `baseElevation` plus `height`, snapped at `0.05m`.
- The reference project creates a saved view from a dragged world-space box and then uses that box as the scope for render participation.
- The reference project resolves plans, elevations, and sections from a shared documentation/projection layer rather than from separate one-off renderers.
- The reference project keeps crisp pane output by combining fit-once rendering, DPR-aware canvas sizing, oversampled backing buffers, and CSS transform zoom/pan.
- The reference project keeps DXF export vector-first by exporting the same projected geometry used by the documentation layer.
- The reference project uses high-resolution offscreen rendering for PNG and image-based PDF export while still reusing the same documentation/projection result.

### Build Order For This Slice

- Step 1: add render data structures and rename the future feature direction from `Views` to `Renders`.
- Step 2: add the `Renders` panel shell and saved render list UI.
- Step 3: add saved render box records on the main canvas, including select/move/resize behavior.
- Step 4: add the lower tab switcher with `Main Canvas` plus saved render tabs.
- Step 5: add the render workspace shell and reference-style pane layout scaffolding.
- Step 6: add the vector-first render documentation/projection cache layer.
- Step 7: add crisp pane auto-fit rendering with pane viewport metadata and CSS-transform zoom/pan.
- Step 8: add `Layer Properties`, `Render Properties`, and `Render Box Properties` flows.
- Step 9: add export flows and pop-out window synchronization.

### Current Progress On This Task

- Reference research is complete for the following pieces:
  - per-view / per-render layer configuration
  - world-space box creation and transform behavior
  - vector-first documentation geometry before final panel rasterization
  - crisp pane auto-fit and CSS-transform viewport behavior
  - DXF / PNG / PDF output paths
  - external pop-out window workflow
- No part of the `Renders` workspace has been implemented in the current app yet.

### Non-Blocking Background

- Browser validation for the canonical draft-angle family system in the current app is still pending, but it is currently a background task and not the critical path for the new `Renders` workspace.
