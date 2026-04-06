# AI Memories

> Rule for Codex: Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes. Use clear headings, preserve existing decisions unless they were replaced, keep the "Current Task" section updated while work is in progress, and move a task's final outcome into the permanent sections below only after the user has tested it and explicitly confirmed that it is complete.

## Project Snapshot

- Last updated: 2026-04-06
- Project type: small browser-based CAD/drawing editor
- Entry file: `index.html`
- Main logic file: `app.js`
- Main geometry dependency: `clipper2-ts`

## What The Application Currently Is

This application is a single-page 2D vector drawing tool that opens directly from `index.html` in the browser. The UI is defined in `index.html`, while the application logic lives in `app.js`.

The editor supports drawing, selecting, moving, erasing, zooming, panning, layer management, and a separate render workspace driven by committed `Render Box` records. Every new shape drawn into a layer is merged into that layer with boolean union logic.

## Current Architecture

### UI Structure

- `index.html` contains the fixed `millimétré` top bar, the left-side `Drawings` panel, the canvas shell, the bottom workspace/tab switcher, and the app's centered modal shells.
- The top bar currently includes the brand shell, `Settings`, `Export`, and `Import` controls, visual-only `Undo` / `Redo` placeholders, and compact live status readouts for grid/workplane state on the right.
- The old floating layers widget is gone; the primary authoring sidebar is now a left-side panel with `Drawings`, nested card-based `Layers`, a `Renders` section, and fixed bottom `Layer Settings` / `Render Settings` triggers.
- The canvas shell now includes four drafting rulers plus all four corner blocks around an inset live viewport.
- The bottom workspace switcher now includes one always-visible `Main` tab plus dynamic `Rbox` tabs that open the render workspace.
- `index.html` now also contains centered modal shells for app settings, import/export flows, and render-related editors, all sharing the same backdrop/modal language.
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
  - `vertexOutlineEligibility`
  - `bounds`
- Boolean union, subtraction, and overlap/intersection checks are handled through `clipper2-ts`.
- The boolean boundary is wrapped by an in-file Clipper adapter layer that preserves the app's nested `[[outer, hole1...]]` multipolygon model.
- The Clipper adapter uses fixed precision integer scaling with a shared `8`-decimal coordinate policy.
- Layer geometry is rebuilt by unioning the shapes that belong to the layer.

### Units Model

- The app now treats `1 world unit = 1 mm`.
- Stored geometry remains in that single canonical internal unit regardless of what the user chooses for display formatting.
- Display units are now a formatting layer with `mm`, `cm`, and `m` options.
- The real-dimensions / units model is now treated as established application behavior rather than an active in-progress task.
- `Cell Size` is now the user-facing size control for the drafting cell, with an integer value plus inline `mm`, `cm`, or `m` unit buttons.
- `Grid Snap` now has two user-facing modes:
  - `Adaptive`: the effective minimum cell is fixed to `1 mm`, the rendered grid and rulers both promote from that minimum through the zoom-adaptive `1-2-5` ladder, and the `Cell Size` controls are shown as locked to `1 mm`.
  - `Locked`: the effective cell comes from the configured `Cell Size` value and its chosen `mm` / `cm` / `m` unit; the rendered grid stays fixed to that locked cell, while the rulers continue to use adaptive graduations derived from it.
- In `Locked`, grid tiers now fade out by screen density instead of promoting to a coarser spacing, and any tier whose opacity reaches zero is skipped entirely so the canvas does not spend time drawing invisible lines.
- The default settings are:
  - `Display Unit = m`
  - `Cell Size = 5 cm` when `Grid Snap = Locked`
  - `Grid Snap = Adaptive`
- This means the default adaptive minimum cell is currently `1 mm`, while switching to `Locked` restores a `5 cm` cell.

### Important Geometry Note

- Ellipses are currently represented as polygon approximations, not as exact analytic ellipse entities.
- This means the app is fully vector-based, but it is a polygon vector pipeline, not a curve-kernel CAD engine.
- This is good for clean boolean union behavior now, but it may need a future architectural upgrade if the project later requires exact curved elevations, sections, exports, or CAD-grade curve persistence.

### Rendering Model

- Rendering is direct vector drawing on the main canvas.
- The canvas background grid now uses a zoom-adaptive visible minor step derived from the base grid, with mid and major tiers rendered at `5x` and `10x` that visible step.
- The active workplane origin is visualized with dedicated draft X=0 and Y=0 axis lines.
- The visible grid stays screen-aligned even when the drafting angle changes.
- World content is rendered through a drafting/workplane transform with both `origin` and `angle`, so stored geometry stays in world coordinates while the user can draw against a translated and rotated drafting frame.
- Wheel-based draft-plane rotation is now canonical instead of accumulated: the workplane tracks a canonical angle family/candidate plus integer step identity, so rotating away and back returns to the same exact plane coefficients instead of a float-near-zero residual angle.
- Trig-generated workplane coordinates and the Clipper adapter now share the same `8`-decimal quantization policy, so rotated world-space geometry enters boolean operations on the same canonical coordinate grid.
- There is no raster-mask union pipeline anymore.
- The render stack now includes always-visible `World` axes drawn underneath everything else, separate from the draft grid/workplane overlay.
- Each visible layer is drawn from its current merged vector shapes.
- The draft canvas (`Grid` + draft-plane axes) is now rendered only while `Draw` is active, and in the current arrangement it is drawn above the visible layer geometry so its readability can take priority during drafting.
- Layer rendering now has settings-controlled outline and corner-marker visibility.
- When `Outline` is enabled, each visible layer shape is stroked with the configured outline color.
- When `Corners` is enabled, outline-eligible vertices render as markers in the current outline color, while outline-ineligible vertices render in a mid gray so vertex provenance stays visible during editing.
- `Corners` is functionally dependent on `Outline`: when `Outline` is off, corner markers do not render.
- In `Draw`, the active layer is a deliberate exception: its outline and corner markers always render with the preview blue emphasis even if the general `Outline` or `Corners` settings are off, and that emphasized pass sits back on top of the draft canvas for readability.
- Selection highlighting is drawn by tracing the selected shape geometries.

### Renders Subsystem

- The app now has a first-class `Renders` subsystem built around `Render` / `Render Box` naming.
- `Main` remains the authoring workspace; render boxes are authored there, and each committed `Rbox` creates one persistent render record plus one matching bottom-tab workspace.
- A render record currently stores:
  - `id`
  - `name`
  - `visible`
  - quantized world-space `boxGeometry`
  - `volume` with `baseElevationMm` and `heightMm`
  - `sectionSettings` with `{ z: [], x: [], y: [] }`
- Render-related layer behavior is global layer-owned data; the current model has no per-render layer overrides, no per-render layer order overrides, and no render opacity control.
- The render workspace keeps per-render layout/pane state and supports preview, sync-fit, and a single externalized pop-out window for the active `Rbox` tab.
- Render output is documentation-first: panes compile from the current drawings, render-layer settings, merged geometry, and the active `Rbox` frame; non-plan directional panes share one vector documentation path, while `Plan` keeps its own builder/painter contract under the same top-level orchestration.
- Directional panes now support depth-aware shading and a global outline pass built from silhouette, depth-transition, and eligible-vertex breaks.
- When an `Rbox` has `heightMm > 0`, side renders use its explicit `Start -> End` vertical range; when `heightMm = 0`, they currently fall back to auto-height from intersecting geometry.
- Export controls are already present in the render workspace shell, but real `DXF` export is not implemented yet.

### Draft Angle Model

- Draft-angle logic is now split more cleanly: `draft-angle.js` owns the draft-angle store, family records, candidate state, active rotation state, lookup-table runtimes, and family/candidate matching, while `app.js` owns only the workplane origin and the pointer/snap interaction that feeds directions into that store.
- Family records are designed as serializable project data with `id`, `kind`, `baseAngleDeg`, optional normalized `baseVectorDx/baseVectorDy`, `stepDegrees`, and `stepCount`.
- The default canonical family covers `0..359` degree steps at `1deg` increments, and each lookup entry stores canonical `cos` and `sin` coefficients rounded to the shared `8`-decimal precision.
- The active workplane rotation is represented as `mode` (`family`, `candidate`, or fallback `free`) plus a family/base descriptor and integer `stepIndex`.
- Family-driven `draft -> world`, `world -> draft`, and world-content canvas rendering all read the active lookup entry's canonical coefficients instead of recomputing trig from a floating angle.
- `app.js` now submits the raw snapped `end - start` align vector into the draft-angle store, and the only remaining normalization/signature canonicalization boundary for align-family matching lives inside `draft-angle.js`.
- Vector-based candidate and dynamic family records now store a quantized normalized base vector, and candidate materialization preserves that canonical base vector directly when promoting the ghost family into a persistent dynamic family.
- `Align` can resolve into an existing known family or into a temporary unresolved candidate family derived from a normalized direction vector; candidate records and persistent dynamic families share the same 360-step lookup-table structure.
- A temporary candidate becomes a persistent dynamic family only when the user commits a real draw or subtract operation under that regime; otherwise it is discarded when the plane is reset or switched back into a known or already-persistent family.
- The browser console exposes the draft-angle store and a live registry view for persistent draft-angle families for debugging.

### Project Persistence Model

- The app now supports project export and import through a strict app-native JSON project file format with `app = millimetre` and a single supported `version = 1`.
- Export/import is based on the app's real project state, not on a lossy visual snapshot.
- Export preserves the stable reopenable project state, including drawing/layer/shape document state, render document state, tool/workspace state, render-workspace snapshot state, app settings/camera/selection state, and the draft-angle snapshot state.
- Shape `bounds` are treated as derived data and are recomputed on import instead of being trusted from the file.
- Render records are normalized on import/export to `id`, `name`, `visible`, quantized world-space `boxGeometry`, `volume`, and `sectionSettings`.
- Import is strict and does not attempt backward compatibility or migration for unsupported versions or schemas.
- Whenever a new feature adds project state that must persist, update the app's export/import flow for that feature as part of the same work.
- During the current development phase, backward compatibility with older project files is not a goal when export/import changes are made for new features.
- When an export/import change breaks compatibility with older project files, explicitly tell the user that compatibility was lost.
- Import replaces the current project only after an explicit confirmation step.
- The app remembers the current project filename in runtime state, updating it from imports and save-picker exports.
- Export prefers `showSaveFilePicker` when available and otherwise falls back to a normal JSON download using the remembered filename, with a one-time notice that direct save-to-folder support is unavailable in the current browser.

### Layer Model

Each layer currently has:

- `id`
- `name`
- `visible`
- `locked`
- `fillColor`
- `render`, with:
  - `enabled`
  - `baseElevationMm`
  - `heightMm`
  - `role`

Layer order controls draw order. The active layer receives new geometry when the user draws.

New layers currently default to `render.enabled = true`, `render.baseElevationMm = 0`, `render.heightMm = 0`, and `render.role = null`.

The current authoring panel behavior is:

- only one drawing is active/expanded at a time
- the app maintains one active layer inside that active drawing
- drawing cards support rename, duplicate, hide/show, delete, and drag reorder
- layer cards support rename, duplicate, hide/show, delete, drag reorder, cross-drawing move, and merge-on-drop into another layer
- layer deletion preserves at least one layer per drawing, and drawing deletion preserves a valid fallback active drawing/layer

### Tools And Interaction

- `Draw`: creates rectangle, ellipse, strip, square-brush geometry, or `Rbox` authoring boxes on the `Main` canvas. Right click subtraction applies only to the geometry modes.
- `Draw` size controls for `Stroke Rect` and `Square Brush` are expressed in whole visible grid cells.
- `Select`: selects and moves one or more whole merged shapes.
- Activating an `Rbox` card enters a separate move-only render-box transform mode on `Main` without changing the underlying base tool.
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
- The app now interprets all world-space geometry coordinates as millimeters.
- Changing `Display Unit` changes measurement formatting only; it does not rescale stored geometry.
- Changing `Cell Size` while `Grid Snap = Locked` changes the effective cell spacing, snapping, rulers, and future cell-based draw widths without resizing existing geometry already stored in world space.
- When zooming far out in `Adaptive`, the visible grid and ruler graduations automatically promote to coarser multiples of the current effective cell so the canvas stays legible instead of drawing every tiny base interval.
- In `Grid Snap = Adaptive`, grid-based snapping and cell-based draw widths follow the promoted visible step, which starts from a fixed `1 mm` minimum cell; in `Grid Snap = Locked`, snapping and cell-based widths stay on the configured `Cell Size`, the rendered grid stays fixed to that cell, and only the rulers continue promoting adaptively.
- In `Locked`, minor grid lines fade first, then mid lines, then major lines as screen spacing collapses, rather than disappearing all at once.
- `Rectangle` and `Ellipse` snapping are active on the visible drafting grid: draw and right-click subtract snap both bounding-box corners to grid intersections, show a snap preview marker at the cursor, and produce bounds aligned exactly to cell multiples.
- `Stroke Rect` width is expressed in whole grid cells, its generated strip width is always an exact multiple of one cell, and its centerline snapping is parity-aware: odd cell widths snap on half-cell centerline families while even cell widths snap on full grid intersections.
- `Stroke Rect` can be drawn at arbitrary drafting angles while preserving its cell-multiple width and parity-aware snapping.
- `Stroke Rect` supports sticky `Shift` axis lock behavior during an active draw: holding `Shift` constrains the strip direction to the draft-space `X` or `Y` axis for the current hold.
- New shapes now also receive per-vertex outline-eligibility metadata at creation time: ellipse approximation vertices default to outline-ineligible, while authored straight/corner tools default to outline-eligible.
- `Square Brush` size is expressed in whole grid cells and its preview is centered on the snapped pointer position.
- `Square Brush` snapping is parity-aware: odd cell widths snap the brush center to cell centers, while even cell widths snap the brush center to grid intersections.
- `Square Brush` records and rebuilds its path from snapped center point to snapped center point, using square-sweep geometry instead of dab-by-dab stamping.
- `Square Brush` supports sticky `Shift` axis lock behavior during an active stroke: pressing `Shift` resets the lock anchor to the current pointer position, the lock direction is chosen from client-space movement, and the chosen axis stays sticky until `Shift` is released.
- While the square-brush axis choice is still undecided after `Shift` is pressed, the stroke holds at the lock anchor instead of recording free diagonal points, so the first committed constrained segment does not leave a diagonal stub.
- `Square Brush` remembers the previous brush point between strokes, so starting a new square-brush stroke with `Shift` can continue immediately from that remembered point.
- Square Brush accumulates live vector draft geometry while dragging and commits the final stroke into the active layer on pointer release.
- In `Draw`, the drafting rulers mirror the active snap preview and drag extent.
- Zoom is currently clamped between a minimum of `0.02` and a maximum of `50`.
- The app maintains a workplane with separate `origin` and canonical draft-angle state, independent from stored geometry.
- Existing geometry is displayed relative to the current workplane, while the visible grid remains horizontal and vertical on screen.
- New drawing input is created in drafting coordinates relative to the current workplane and converted back into world geometry before boolean union with the layer.
- World-space vertices produced from rotated draft geometry are quantized to the same shared `8`-decimal precision used by the Clipper boolean boundary.
- `Space + wheel` mutates only the integer `stepIndex` of the active draft-angle family or candidate, so returning to a previous step reuses the exact same canonical lookup coefficients.
- Wheel-based workplane rotation no longer accumulates float angle drift: returning by the same number of wheel steps restores the exact same derived plane angle, which prevents post-rotate seams caused by near-zero residual rotation.
- Known-family transforms, candidate-family transforms, and world-content canvas rendering all use the same active canonical `cos/sin` coefficients.
- While `Space` is held, the normal draw/select interaction is temporarily suspended and the pointer is used for drafting transformations instead.
- `Space + Left Drag` workplane alignment can start and end anywhere in space, with nearby geometry acting as a magnetic snap target.
- The start/origin snap allows only `corner` or `free` placement, while the dragged end point can resolve to `corner`, `edge`, or `free`.
- The resulting alignment direction is always derived from the resolved `end - start` vector of those chosen endpoints.
- `Align Snap` supports `Off`, `15deg`, `30deg`, `45deg`, and `90deg`; geometry snaps take precedence over magnetic angle snaps, and magnetic angle snaps stay constrained to the current active family.
- If an aligned direction matches a known family signature, the workplane re-enters that family; otherwise it activates or reuses a temporary unresolved candidate family for that direction regime.
- The first committed draw or subtract operation while a candidate family is active materializes it into a persistent dynamic family; resetting the plane or leaving that regime without a commit discards the temporary candidate.
- Pressing `R` while `Space` is held resets the current workplane to the world-aligned plane, cancels any in-progress draft transform drag, and leaves drafting-transforms mode active as long as `Space` remains held.
- Releasing `Space` during a pending workplane alignment cancels that alignment and returns control to the underlying tool.
- The top bar now shows a live workplane status readout with the current plane mode (`default` when the workplane is unmodified, otherwise `custom`), rotation in degrees formatted to up to `2` decimal places, and origin coordinates formatted in the active display unit.
- The settings modal now exposes `Outline` and `Corners` toggles; `Outline` also includes a color swatch, while `Corners` inherits that same outline color and is disabled whenever `Outline` is off.
- The settings modal now also exposes `Align Snap` with `Off`, `15deg`, `30deg`, `45deg`, and `90deg` options for workplane align-drag magnetic snapping.
- The top bar `Export` button now exports the current project state through either the browser save picker or the browser's normal download flow, depending on browser capability.
- The top bar `Import` button now imports a project file and replaces the current project after confirmation if the file passes strict validation.
- In `Select`, the draft canvas (`Grid` + draft-plane axes) is hidden while the `World` axes remain visible underneath the scene.
- In `Draw`, both the `World` axes and the draft canvas are visible; the `World` axes render underneath the layer geometry, the draft canvas renders above the regular layer geometry, and the active layer's emphasized outline/corners are then re-drawn on top of the draft canvas.
- `Select` supports marquee selection in draft/screen space: dragging right selects only shapes fully enclosed by the box, while dragging left selects shapes that are enclosed by or intersect the box.
- Holding `Shift` in `Select` toggles selection membership for both click and marquee selection: newly hit shapes are added while already selected shapes captured by the click or box are removed.
- Multi-selected shapes move together when dragged from a selected shape.
- Pressing `Escape` while in `Select` with an active selection clears that selection.
- Right click in `Draw` uses the current shape mode as subtraction geometry and applies boolean difference against the active layer's merged vector geometry.
- After drawing, the new geometry is inserted into the layer and the layer is rebuilt through boolean union.
- After subtractive drawing, the active layer is replaced with the resulting difference geometry instead of deleting whole merged objects by hit-test.
- Before layer shapes are recreated, both boolean union results and subtractive difference results are passed through Clipper collinear simplification, so exact straight-line extra vertices can be removed from both additive and subtractive outcomes.
- After moving selected geometry, the affected layer or layers are rebuilt again so intersections and merges stay correct.
- Draft rulers now format labels in the active display unit rather than as raw cell indices.
- Hidden layers are not rendered.
- Locked layers do not accept edits.
- The `Drawings` add button creates a real new drawing with a default layer inside it and makes that drawing/layer active.
- The nested `Layers` add button creates a real new layer inside the current drawing.
- A newly added layer now inserts directly above the current active layer in that drawing instead of always being created at the very top of the stack.
- Drawing drag reorder updates actual canvas paint order across drawings.
- Layer drag reorder updates actual paint order within the drawing, and layer drag can also move a layer into another drawing or merge it into another layer while preserving the target layer's properties.
- `Add Rbox` arms `Draw > Rbox` on `Main` instead of creating an empty render record.
- `Rbox` drawing follows the same Draft Plane input rules as the other draw shapes, previews as a strong-orange dashed no-fill box, and creates the render record only on commit.
- Committed `Rboxes` render on `Main` as strong-orange overlays with a rotated name label and side initials.
- While an `Rbox` is active, normal layer draw/select interaction is suspended, draw-only preview helpers stay hidden, and `Escape` deactivates it without rewriting the underlying base tool.
- When two directional render candidates land at the same visible depth, the current `Layer Settings` order is the tie-breaker.

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
- External example or inspiration folders are not part of the default startup reading context for new chats. Inspect them only when the user explicitly asks for a comparison or migration from one of those files.
- When external examples are used during design or implementation, treat them only as temporary comparison material. Do not carry over labels like `reference`, `ref`, or other example-specific naming into `AI Memories.md`, source files, comments, variables, CSS tokens, or UI labels.
- Naming written anywhere in the project should come from what the feature actually is in this app. Prefer stable app-native names that describe the real role, behavior, or visual meaning of the thing being built, rather than names borrowed from another file or temporary migration context.

## Known Bugs

### 1. Non-Orthogonal Draft-Plane Re-Align / Diagonal Canonicalization Bug

- Status: open. The `clipperSimplifyCollinearEpsilon = 2` test was completed and did not solve the issue, so that is not considered a viable fix path.
- Symptom: when the user aligns the workplane onto a diagonal shape that was not originally drawn inside that family, new geometry drawn in the resulting family is not perfectly orthonormal with the original diagonal shape. This causes small misalignment artifacts and spurious vertices when the two interact in boolean operations.
- Root cause (identified 2026-04-01): the `cos/sin` coefficients stored in draft-angle family lookup entries are quantized to 8 decimal places via `quantizeAngleValue`. This introduces an error of ~5e-9 per unit, which at the Clipper scale of 1e8 accumulates to ~50 Clipper units for a 100-unit shape. The resulting edge directions are slightly off from the true aligned direction, so edges that should be exactly parallel or collinear are not.
- Principled fix (not yet implemented): in `buildDraftAngleEntry` in `draft-angle.js`, store full IEEE 754 precision `cos/sin` for geometry use and keep quantized values only for the signature lookup. This eliminates the quantization error at the source.
- Test result: raising `clipperSimplifyCollinearEpsilon` from `1` to `2` did not absorb the angular mismatch artifacts in practice, so increasing that epsilon does not resolve this bug.

### 2. Clipper Integer Rounding Creates Spurious Vertices At Non-Orthogonal Intersections

- Status: fixed 2026-04-01 with `clipperSimplifyCollinearEpsilon = 1`.
- Symptom: when boolean-unioning shapes that intersect at non-orthogonal angles (e.g. a diagonal stroke crossing an axis-aligned stroke), Clipper's integer arithmetic placed intersection vertices up to 1 Clipper unit (1e-8 world units) off the original edge. With epsilon=0 the collinear simplifier did not remove these, leaving visible spurious vertex markers on what should be a clean straight edge.
- Fix: changed `clipperSimplifyCollinearEpsilon` from `0` to `1` in `app.js` (line 139). The simplifier now removes near-collinear intermediate vertices within 1 Clipper unit, which is imperceptible (1e-8 world units) and does not affect geometry visible at any zoom level or affect alignment between layers.

## Current Task

### Current Task 1: Section Behavior And Documentation Stabilization

- Task: build the remaining section behavior and documentation-stabilization work for the `Renders` subsystem, then return to the real export path afterward.
- Status: active. The broader `Renders` subsystem is now treated as established behavior and has been moved into the permanent sections above. The immediate open work is section-aware/documentation-aware behavior, with real export remaining as a later follow-up rather than the next implementation step.

#### Task Rule

- For this remaining render work, always write and agree on a clear step-by-step implementation plan before making code changes.

#### Immediate Focus

- Build the actual `Section Behavior` from the current documentation-first render architecture while preserving the intentional `Plan` / side-view split.
- Continue into stronger section-aware/documentation-aware behavior once that section logic is in place.
- After that logic is stable, return to real `DXF` export and then add a higher-resolution offscreen raster backing path for on-screen panes.
