# AI Memories

> Rule for Codex: Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes. Use clear headings, preserve existing decisions unless they were replaced, keep the "Current Task" section updated while work is in progress, and move a task's final outcome into the permanent sections below only after the user has tested it and explicitly confirmed that it is complete.

## Project Snapshot

- Last updated: 2026-04-02
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
- `index.html` now also contains a centered settings modal shell with a backdrop for unit, snapping, and canvas edge/corner display configuration.
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

### Units Model

- The app now treats `1 world unit = 1 mm`.
- Stored geometry remains in that single canonical internal unit regardless of what the user chooses for display formatting.
- Display units are now a formatting layer with `mm`, `cm`, and `m` options.
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
- When `Corners` is enabled, each stored polygon vertex is rendered as a marker using that same outline color.
- `Corners` is functionally dependent on `Outline`: when `Outline` is off, corner markers do not render.
- In `Draw`, the active layer is a deliberate exception: its outline and corner markers always render with the preview blue emphasis even if the general `Outline` or `Corners` settings are off.
- Selection highlighting is drawn by tracing the selected shape geometries.

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
- `Square Brush` size is expressed in whole grid cells and its preview is centered on the snapped pointer position.
- `Square Brush` snapping is parity-aware: odd cell widths snap the brush center to cell centers, while even cell widths snap the brush center to grid intersections.
- `Square Brush` records and rebuilds its path from snapped center point to snapped center point, using square-sweep geometry instead of dab-by-dab stamping.
- `Square Brush` supports sticky `Shift` axis lock behavior during an active stroke: pressing `Shift` resets the lock anchor to the current pointer position, the lock direction is chosen from client-space movement, and the chosen axis stays sticky until `Shift` is released.
- While the square-brush axis choice is still undecided after `Shift` is pressed, the stroke holds at the lock anchor instead of recording free diagonal points, so the first committed constrained segment does not leave a diagonal stub.
- `Square Brush` remembers the previous brush point between strokes, so starting a new square-brush stroke with `Shift` can continue immediately from that remembered point.
- Square Brush accumulates live vector draft geometry while dragging and commits the final stroke into the active layer on pointer release.
- In `Draw`, the drafting rulers now show live cyan/red capsule indicators derived from the same snapped preview source as the canvas preview: idle non-brush tools collapse to a dot-like capsule at the snap point, drag operations expand the capsule to the live draft-space extent on each axis, and idle `Square Brush` shows its footprint rather than only its center.
- Zoom is currently clamped between a minimum of `0.02` and a maximum of `50`.
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
- During `Space + Left Drag`, the initial `mousedown` start/origin snap now allows only `corner` or `free` placement; `edge` snapping is intentionally disabled for the start point to avoid the known edge-origin instability.
- During an active `Space + Left Drag`, the dragged end point still allows full `corner`, `edge`, or `free` snapping, so edge direction pickup remains available at release.
- During `Space + Left Drag`, if there is no nearby geometry, the preview and resulting alignment still use the free pointer position instead of forcing a snap.
- During an active `Space + Left Drag`, the align preview now draws a faint infinite dashed cross through the chosen start/origin point, with one axis parallel to the current align direction and the other perpendicular to it.
- During `Space + Left Drag`, snapping affects only the chosen start/end points; the resulting alignment direction is always derived from the raw point-to-point `end - start` vector of those resolved endpoints.
- During `Space + Left Drag`, the raw pointer now magnetizes to a narrow fixed-width screen-space corridor around the current active workplane's orthogonal axes, which makes it possible to move the draft origin without accidentally leaving the current family regime.
- If an aligned direction matches a known family signature, the workplane re-enters that family; otherwise it activates or reuses a temporary unresolved candidate family for that direction regime.
- The first committed draw or subtract operation while a candidate family is active materializes it into a persistent dynamic family; resetting the plane or leaving that regime without a commit discards the temporary candidate.
- Pressing `R` while `Space` is held resets the current workplane to the world-aligned plane, cancels any in-progress draft transform drag, and leaves drafting-transforms mode active as long as `Space` remains held.
- Releasing `Space` during a pending workplane alignment cancels that alignment and returns control to the underlying tool.
- The top bar now shows a live workplane status readout with the current plane mode (`default` when the workplane is unmodified, otherwise `custom`), rotation in degrees formatted to up to `2` decimal places, and origin coordinates formatted in the active display unit.
- The settings modal now exposes `Outline` and `Corners` toggles; `Outline` also includes a color swatch, while `Corners` inherits that same outline color and is disabled whenever `Outline` is off.
- In `Select`, the draft canvas (`Grid` + draft-plane axes) is hidden while the `World` axes remain visible underneath the scene.
- In `Draw`, both the `World` axes and the draft canvas are visible; the `World` axes render underneath the layer geometry, while the draft canvas currently renders above the layer fills, outlines, and corners.
- `Select` supports marquee selection in draft/screen space: dragging right selects only shapes fully enclosed by the box, while dragging left selects shapes that are enclosed by or intersect the box.
- Holding `Shift` in `Select` toggles selection membership for both click and marquee selection: newly hit shapes are added while already selected shapes captured by the click or box are removed.
- Multi-selected shapes move together when dragged from a selected shape.
- Pressing `Escape` while in `Select` with an active selection clears that selection.
- Right click in `Draw` uses the current shape mode as subtraction geometry and applies boolean difference against the active layer's merged vector geometry.
- After drawing, the new geometry is inserted into the layer and the layer is rebuilt through boolean union.
- After subtractive drawing, the active layer is replaced with the resulting difference geometry instead of deleting whole merged objects by hit-test.
- Before layer shapes are recreated, both boolean union results and subtractive difference results are passed through Clipper collinear simplification, so exact straight-line extra vertices can be removed from both additive and subtractive outcomes.
- After moving selected geometry, the affected layer or layers are rebuilt again so intersections and merges stay correct.
- Draft rulers now format labels in the active display unit rather than as raw cell indices, and they use adaptive label thinning/collision avoidance so labels stay readable at far zoom.
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
- External example or inspiration folders are not part of the default startup reading context for new chats. Inspect them only when the user explicitly asks for a comparison or migration from one of those files.
- When external examples are used during design or implementation, treat them only as temporary comparison material. Do not carry over labels like `reference`, `ref`, or other example-specific naming into `AI Memories.md`, source files, comments, variables, CSS tokens, or UI labels.
- Naming written anywhere in the project should come from what the feature actually is in this app. Prefer stable app-native names that describe the real role, behavior, or visual meaning of the thing being built, rather than names borrowed from another file or temporary migration context.

## Known Bugs

### 1. Non-Orthogonal Draft-Plane Re-Align / Diagonal Canonicalization Bug

- Status: open. Investigating fix via `clipperSimplifyCollinearEpsilon = 2` (currently testing).
- Symptom: when the user aligns the workplane onto a diagonal shape that was not originally drawn inside that family, new geometry drawn in the resulting family is not perfectly orthonormal with the original diagonal shape. This causes small misalignment artifacts and spurious vertices when the two interact in boolean operations.
- Root cause (identified 2026-04-01): the `cos/sin` coefficients stored in draft-angle family lookup entries are quantized to 8 decimal places via `quantizeAngleValue`. This introduces an error of ~5e-9 per unit, which at the Clipper scale of 1e8 accumulates to ~50 Clipper units for a 100-unit shape. The resulting edge directions are slightly off from the true aligned direction, so edges that should be exactly parallel or collinear are not.
- Principled fix (not yet implemented): in `buildDraftAngleEntry` in `draft-angle.js`, store full IEEE 754 precision `cos/sin` for geometry use and keep quantized values only for the signature lookup. This eliminates the quantization error at the source.
- Current test: checking whether raising `clipperSimplifyCollinearEpsilon` from 1 to 2 is sufficient to absorb the angular mismatch artifacts in practice, before committing to the more invasive draft-angle change.

### 2. Clipper Integer Rounding Creates Spurious Vertices At Non-Orthogonal Intersections

- Status: fixed 2026-04-01 with `clipperSimplifyCollinearEpsilon = 1`.
- Symptom: when boolean-unioning shapes that intersect at non-orthogonal angles (e.g. a diagonal stroke crossing an axis-aligned stroke), Clipper's integer arithmetic placed intersection vertices up to 1 Clipper unit (1e-8 world units) off the original edge. With epsilon=0 the collinear simplifier did not remove these, leaving visible spurious vertex markers on what should be a clean straight edge.
- Fix: changed `clipperSimplifyCollinearEpsilon` from `0` to `1` in `app.js` (line 139). The simplifier now removes near-collinear intermediate vertices within 1 Clipper unit, which is imperceptible (1e-8 world units) and does not affect geometry visible at any zoom level or affect alignment between layers.

## Current Tasks

### Current Task 1: Interface Implementation

- Task: continue building and polishing the application's interface around the current `millimétré` shell, drawings panel, canvas shell, and interaction patterns already implemented in the app.
- Status: interface implementation remains active. The previous `Renders`-workspace task is no longer the current tracked task here.

#### Source Of Truth

- Use the current app files, especially `index.html` and `app.js`, as the source of truth for ongoing interface work.
- If an external example file is needed for comparison, treat it as temporary research input rather than as a permanent naming source.

#### Interface Scope

- Rework and polish the app shell around the current interface direction already established in the project.
- The target interface now includes:
  - top bar
  - left-side panel structure
  - canvas shell
  - floating tools
  - floating side panels
  - bottom view/tab switcher
  - modal and properties panel shells
- The immediate focus is interface layout, component structure, naming, and interaction scaffolding before deeper feature-complete behavior.

#### Interface Direction Locked In

- Keep the current visual hierarchy and spatial organization coherent while we continue refining the interface.
- Keep the project compatible with plain browser deployment from `index.html` and native browser JavaScript without introducing a build step.
- Preserve the current app's real geometry and drafting behavior unless a UI change explicitly requires a behavioral integration.
- When temporary migration names are still present, rename them toward permanent app-native naming as the interface stabilizes.

#### Progress

- The active task has been reset from the old `Renders` planning track to interface implementation.
- The current app shell now includes the `millimétré` top bar with the current button order, brand styling, separator, translucent surface treatment, and hover behavior.
- The `Settings` button in the top bar is now wired to a real modal; the remaining top bar buttons are still visual-only placeholders.
- The settings modal now uses a single `Settings` heading with extra breathing room before the rows.
- The canvas sizing logic now measures the actual visible canvas area below the new fixed header row so the drawing surface still renders correctly under the updated app shell.
- The canvas shell now includes four-sided drafting rulers around the live canvas viewport plus all four corner blocks, with the inner drawing viewport inset inside that frame.
- Ruler ticks and labels are now drawn from the app's live camera pan, zoom, and grid intervals instead of static DOM marks, and the ruler canvases resize together with the main drawing canvas.
- The right side of the top bar now includes compact live status readouts for grid/workplane state instead of showing them inside the floating canvas toolbar.
- The old floating layers widget has been replaced by a left-side panel shell with a `Drawings` section.
- The left panel now renders a `Drawing 1` container with nested `Layers` cards and the new card-based visual hierarchy.
- Layer cards now span the full width of the nested layers list instead of sitting inside an extra left indent.
- Layer cards now show inline duplicate / visibility / delete icons plus an `Opacity` slider row, and the active layer expands while inactive layers stay collapsed.
- Each layer card now shows a small clickable circular fill-color swatch between the drag handle and the layer name, and that swatch remains visible even when the layer card is collapsed.
- The layer object-count and opacity rows now span the full layer-card width, starting from the drag-handle edge instead of the name column.
- Layer drag can now move a layer into a different drawing by dropping it onto another drawing card; the moved layer becomes the top layer in the target drawing, and if the source drawing would become empty it automatically keeps a fallback empty layer.
- Layer drag now also supports merge-on-drop over another layer card: hovering the middle of a target layer card shows the same soft neutral hover state, and dropping unions the source layer geometry into the target layer while preserving the target layer's properties and deleting the source layer.
- Each layer card now shows a total area row above the object count, and that area is formatted in the active `Display Unit` squared (`mm²`, `cm²`, or `m²`).
- The settings modal now includes `Outline` and `Corners` rows below `Cell Size`; `Outline` has `On/Off` plus a circular color swatch, while `Corners` has `On/Off` only and is disabled whenever `Outline` is off.
- The canvas render stack is now being split into always-visible terracotta `World` axes plus a draft-canvas layer (`Grid` + draft-plane axes) that is shown only in `Draw`; in the current test arrangement the draft canvas renders above layer fills and edges so the visibility/readability tradeoff can be evaluated.
- The panel now follows an active-drawing model: only one drawing is active/expanded at a time, and the app keeps a single active layer inside that active drawing.
- The main `Drawings` add button now creates a real new drawing with a default layer inside it and makes that drawing/layer active.
- Drawing header controls now work for duplicate, hide/show, and delete; duplicating a drawing clones its layers and stored shapes, hiding a drawing suppresses its layers from render/select/snap, and deleting a drawing removes its layers/shapes while preserving a valid fallback active drawing/layer.
- The nested `Layers` add button creates real app layers in the current drawing container, and layer deletion now preserves at least one layer per drawing.
- Drawing drag-reordering now works with the same custom left-panel pointer drag model used by layers, using insertion markers and updating actual canvas paint order across drawings.
- The last-card insertion marker spacing for drawing drag has been tuned separately so the drop line below the final drawing matches the layer-list behavior more closely.
- Layer drag-reordering inside the nested `Layers` list now uses a custom pointer drag interaction with insertion markers and commit-on-drop behavior, without a separate floating preview card.
- The drag reorder logic translates the visible top-to-bottom layer order in the left panel back into the app's underlying drawing/render order so the panel stack and canvas paint order stay aligned.
- Clicking the expanded drawing name now swaps the label into the same inline rename input pattern used by layers; blur or `Enter` commits, while `Escape` cancels and restores the previous name.
- Clicking the active layer name now swaps the label into an inline rename input that auto-focuses; `Enter` or blur commits the new name, while `Escape` cancels and restores the previous name.
- Current duplicate behavior clones layers/drawings into the same world position with new ids and cloned geometry; there is no confirmed cross-layer or cross-drawing boolean merge bug from that flow, but exact overlap can visually resemble a shared result until one copy is moved or edited.
- Layer cards no longer show the `Vector-authored layer` subtitle on normal unlocked layers; the secondary subtitle row now appears only for genuinely locked layers.
- The layer-card object count now refreshes immediately after committed draw/subtract operations and after committed geometry rebuilds caused by moving selected shapes.
- The old bottom-left instructional hint panel inside the canvas shell has been removed completely, including its markup and styling.
- The canvas background now uses a warmer off-white canvas tone, while the grid keeps the app's own line widths and transparency-style hierarchy using darker light-theme strokes derived from the same palette rather than a single opaque color.

### Current Task 2: Real Dimensions And Units Model

- Task: give the editor real dimensions so drawing happens in physical units, and prepare the app for unit-aware measurements, object readouts, and configurable grid spacing.
- Status: implementation is now in progress. The current model uses `1 world unit = 1 mm` and keeps display units separate from stored geometry.

#### Scope

- Make the drawing space represent real physical size rather than arbitrary abstract units.
- Preserve a single canonical storage unit internally even when the user later changes display units.
- Allow future UI readouts to display values in `mm`, `cm`, or `m` without changing stored geometry.
- Allow the grid system to expose a user-configured cell size together with adaptive or locked snapping behavior.

#### Direction Under Discussion

- The internal geometry model now stores everything in millimeters, with `1 world unit = 1 mm`.
- Display units should be a formatting layer only, not a geometry/storage layer.
- Grid spacing should also resolve into millimeters internally, even if the user configures it in `cm` or `m`.
- This task should eventually affect:
  - measurement formatting
  - object/property readouts
  - ruler labels
  - grid spacing controls
  - future dimensioning tools
- Existing world geometry, booleans, and draft-plane math should stay in the same coordinate system; the main change should be semantic meaning plus unit-aware formatting and controls.

#### Progress

- A second active task has now been opened specifically for real dimensions and units.
- The app now uses millimeters as the canonical internal world unit.
- The top bar `Settings` button now opens a centered settings modal shell styled from the reference modal language, but with app-specific content only.
- The first settings group now exposes `Display Unit`, `Grid Snap`, `Cell Size`, `Outline`, and `Corners`.
- The separate `Grid` selector has been removed; the `Cell Size` row now includes inline `mm`, `cm`, and `m` unit buttons next to the numeric field.
- The settings modal now exposes `Grid Snap` with `Adaptive` and `Locked` choices.
- The current supported display units are `mm`, `cm`, and `m`.
- `Cell Size` now accepts integer values and combines with the selected inline `mm` / `cm` / `m` unit to derive the locked cell size in millimeters.
- In `Adaptive`, the `Cell Size` field displays the effective minimum `1 mm` cell and the unit buttons are disabled; the previous locked value is preserved and reappears when switching back to `Locked`.
- The default settings are currently `Display Unit = m`, `Grid Snap = Adaptive`, and a stored locked `Cell Size = 5 cm`.
- The outline defaults are currently `Outline = On`, `Corners = On`, and `Outline Color = #0f172a`.
- Cell-based tools still operate in whole cells rather than absolute unit inputs; their real world width now follows the current effective cell, which is adaptive in `Adaptive` mode and user-configured in `Locked` mode.
- Existing stored geometry is not rescaled when the user applies new display or grid settings.
- Rulers and the workplane origin readout now format values using the active display unit.
- In `Adaptive`, the visible grid and rulers adapt to zoom with a `1-2-5` step ladder, so very small cells stay usable when zoomed far out instead of turning into dense visual noise.
- In `Locked`, the rendered grid stays fixed to the configured cell while the rulers still use adaptive `1-2-5` graduations.
- The top-bar grid status readout now shows only the current snap mode (`Adaptive` or `Locked`) together with the current effective cell.
- The top-bar `Cell` value is always formatted in the active `Display Unit`; in `Adaptive`, it reflects the current effective adaptive view cell, and in `Locked`, it reflects the user's configured fixed cell.
