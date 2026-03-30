# AI Memories

> Rule for Codex: Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes. Use clear headings, preserve existing decisions unless they were replaced, keep the "Current Task" section updated while work is in progress, and move a task's final outcome into the permanent sections below only after the user has tested it and explicitly confirmed that it is complete.

## Project Snapshot

- Last updated: 2026-03-30
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
- Wheel-based draft-plane rotation is now canonical instead of accumulated: the workplane keeps a normalized base angle plus an integer wheel-step offset, so rotating away and back returns to the same exact plane instead of a float-near-zero residual angle.
- Trig-generated workplane coordinates and the Clipper adapter now share the same `8`-decimal quantization policy, so rotated world-space geometry enters boolean operations on the same canonical coordinate grid.
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
- World-space vertices produced from rotated draft geometry are quantized to the same shared `8`-decimal precision used by the Clipper boolean boundary.
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

- Task: implement a canonical draft-angle lookup-table system for `Space + wheel`, plus dynamic angle families for `Align`.
- Status: canonical angle-family system is implemented in code, including unresolved `Align` candidates and first-commit dynamic-family adoption; browser validation and user confirmation are still pending.
- Progress:
  - Implemented in the current slice:
    - Added a browser-native `draft-angle.js` module for serializable family records plus runtime lookup-table generation.
    - Added the canonical default family for `0..359` degree steps, with lookup entries that store stable `sin` and `cos` coefficients rounded to the shared `8`-decimal precision.
    - Reworked workplane angle state so the active regime is now represented as `family/free base + integer step`, instead of relying on `draftAngleBase + draftAngleStepOffset` float recomputation inside the transform path.
    - `Space + wheel` now advances the active workplane through integer step identity and the active workplane transform reads coefficients from the current family entry when the plane is in a known family.
    - `draft -> world` and `world -> draft` now use lookup-backed coefficients for family-driven planes, while the fallback free-angle path still exists for unresolved non-family angles.
    - `Align` now resolves through the same new angle-state abstraction: if the aligned direction matches a known family signature it re-enters that family, otherwise it falls back to a quantized free-angle regime instead of writing raw base-angle float state directly.
    - The workplane runtime/state shape is now set up to remain serializable and leaves room for later persistent dynamic families without changing the plain-browser / native-ES-module architecture.
    - The workplane status readout now formats the rotation value with up to `15` decimal places, while origin coordinates keep the shorter display format.
    - `Align` to an unknown direction now activates an unresolved temporary candidate family instead of immediately persisting a new dynamic family.
    - If a later `Align` lands on a direction that belongs to the same unresolved candidate regime, the candidate is reused with the matching step instead of creating another candidate.
    - The first real committed draw operation under an unresolved candidate regime now materializes that candidate into a persistent dynamic family, for both `Add` and `Subtract`.
    - Leaving the unresolved regime by resetting the plane or aligning into a known/persistent family now discards the temporary candidate instead of keeping it around as a persistent family.
    - The union rebuild path now runs Clipper simplification on the union result before recreating layer shapes, so exact collinear vertices can be removed instead of surviving as extra snap corners along straight sides.
    - A console-side live registry monitor is now available for persistent draft-angle families, showing each family's `baseAngleDeg` plus canonical `baseVectorDx/baseVectorDy`, and it refreshes automatically whenever a new family is materialized on commit.
    - The `Align` path now logs a dedicated debug console block for each successful align event, including the computed align angle in degrees and the raw `dx/dy` vector components at `15` decimal places for testing.
    - The live registry monitor no longer clears the browser console before printing, so align/debug output now accumulates as scrollable console history for side-by-side comparison across events.
  - The `Space + wheel` path should become integer-driven:
    - the active wheel rotation must be treated as a canonical integer degree step;
    - app logic should feed the wheel path with that integer degree identity rather than a derived floating-point degree value.
  - A fixed default lookup table should cover the base draft-angle family for `0..359` degree steps.
  - Each default table entry should store canonical `sin` and `cos` coefficients rounded to the same shared `8`-decimal precision used elsewhere in the geometry pipeline.
  - During `draft -> world` and `world -> draft` transforms, the wheel-driven path should read trig coefficients from the active lookup-table family instead of recomputing `Math.sin(...)` / `Math.cos(...)` on demand.
  - This matters even when the user draws geometry at non-axis draft angles inside the current plane: the internal draft geometry may have its own relative direction, but the plane transfer into world space must still use the canonical trig coefficients of the active draft-angle family.
  - The default integer family must remain stable when the user rotates away and back again with `Space + wheel`, so revisiting the same degree step always reuses the exact same canonical trig coefficients.
  - `Align` needs two behaviors:
    - if the aligned edge direction matches a known canonical family direction, `Align` should snap back into that existing family rather than keeping a raw floating angle;
    - if the aligned direction does not match any known family, `Align` should be able to work with a temporary candidate canonical angle even before a persistent family exists.
  - Dynamic angle families should use the same `8`-decimal canonical precision for their base angle and generated trig coefficients.
  - A dynamic family is conceptually a full 360-step regime derived from its base angle:
    - example: a family created at `14.37deg` should also provide canonical entries for `15.37deg`, `16.37deg`, and so on modulo `360deg`.
  - `Align` can come from nearby geometry, from relationships between different shapes, or from free-space placement in the air, so the app must not assume that every aligned direction corresponds to an already-persistent family.
  - Dynamic families should not be persisted immediately on `Align` alone, because the user may align to a temporary direction and never draw anything.
  - A new dynamic family should become persistent only after the user actually commits new geometry while that unresolved aligned direction is active.
  - A committed drawing operation should count whether it adds geometry or subtracts geometry, because a new aligned family may be adopted specifically for a precise subtractive edit.
  - If the user aligns to a new unresolved direction but does not commit any new geometry, the temporary candidate should be discarded instead of leaving behind an unused family.
  - Dynamic families therefore should be materialized on first committed draw/adoption under that angle regime, not merely on detection of a new aligned direction and not merely because a newly drawn shape happens to contain an unusual angle.
  - The current free-angle trig path should remain as a temporary fallback for non-integer/non-family angles until the full family system is implemented.
  - A future `Select`-mode rotate transform is also expected to follow the same canonical angle model:
    - selected shapes should rotate in exact `1deg` wheel steps;
    - the rotate interaction should be integer-step driven rather than cumulative floating-angle driven;
    - preview and commit should be computed from the original selection snapshot plus the total integer step delta, not by repeatedly re-rotating already-rotated geometry.
    - the rotation pivot should be the centroid/selection center of the current selection, whether the user has selected one shape or multiple shapes.
  - `Select`-mode rotate should not create persistent angle families by itself.
  - If the user later `Align`s to an edge direction of a rotated shape, the app should then resolve or create the corresponding canonical family from that edge direction.
  - Dynamic families created from rotated-shape edge directions should still behave as full 360-step families, so earlier and later directions of that same rotated regime remain reachable within the same family.
  - Even before export/import exists in the UI, angle families should be designed as serializable project data rather than as ad-hoc runtime-only helpers, because future export must preserve existing families and future import must restore them.
