# AI Memories V2

## Rules

Important: the following rules should always be read and remain in effect throughout the whole session.

### Maintenance Rules

- Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes, and update the relevant section immediately when a feature changes the way the program works.
- Every time this file is edited, update `Latest Update` with the current date and time plus a very brief note of the latest change. Keep that note extremely short.
- Use clear headings.
- Preserve existing decisions unless they were replaced.
- This file should describe the real current behavior of the app, not plans disguised as facts.

### Current Task Rules

- Keep the `Current Task` section updated while work is in progress, and track in-progress work only there until the user has tested it and confirmed it is complete.
- Before user confirmation, update only the `Progress` inside `Current Task` rather than moving unfinished work into the permanent sections.
- Once the user confirms the task is complete, move the lasting result into the permanent sections above and clear the task section.

### Bugs Rules

- When bugs are identified, record them in a `Known Bugs` section placed above `Current Task`, and include both the current status and any progress or chosen next method for fixing them.

### Reference Rules

- External example or inspiration folders are not part of the default startup reading context for new chats. Inspect them only when the user explicitly asks for a comparison or migration from one of those files.
- When external examples are used during design or implementation, treat them only as temporary comparison material.
- Do not carry over labels like `reference`, `ref`, or other example-specific naming into `AI Memories` files, source files, comments, variables, CSS tokens, or UI labels.
- Naming written anywhere in the project should come from what the feature actually is in this app. Prefer stable app-native names that describe the real role, behavior, or visual meaning of the thing being built, rather than names borrowed from another file or temporary migration context.

### Export-Import Rules

- Whenever a new feature adds project state that must persist, update the app's export/import flow for that feature as part of the same work.
- During the current development phase, backward compatibility with older project files is not a goal when export/import changes are made for new features.
- When an export/import change breaks compatibility with older project files, explicitly tell the user that compatibility was lost.

## What The App Is

`millimétré` is a browser-based 2.5D vector drafting / CAD tool focused on building geometry and turning it into design-documentation outputs.

It is aimed at workflows where someone wants to author clean vector geometry, organize it spatially, and produce things like plans, views / elevations, drawings, and related documentation.

Its geometry pipeline is based on vector and boolean operations, and the long-term goal is to grow into a lightweight browser-native design-documentation workflow.

## Latest Update

- Last updated: 2026-04-06 02:59 EEST
- Latest change: added `Known Bugs`.

## App Structure

- `index.html`: main application shell and DOM structure for the browser UI.
- `app.js`: main runtime file; owns most app state, interaction flow, rendering flow, project persistence, and render-workspace behavior.
- `draft-angle.js`: dedicated draft-angle / workplane subsystem, kept separate from `app.js`.
- `package.json` / `package-lock.json`: minimal npm package metadata and dependency lockfile for the project.
- `node_modules/`: installed dependencies, including the main geometry dependency used by the app.
- `Reference Only/`: external comparison / research material; useful for study, but not part of the app's own source of truth.
- `AI Memories.md`: older, more detailed memory file with broader historical context.
- `AI Memories V2.md`: newer, slimmer onboarding-focused memory file intended to replace the original over time.

## Core Architecture

- The main authoring context is the canvas, where geometry is created against a drafting / workplane system while the underlying geometry stays stored in world space.
- The app is split between two top-level workspace roles: `Main` for authoring on the live canvas, and `Rbox`-driven render workspaces for documentation output.
- The canonical units model is `1 world unit = 1 mm`; stored geometry stays in that unit and display units are a formatting layer on top.
- The drafting / workplane can move and rotate independently from stored geometry, and its angle-family logic is handled through the draft-angle subsystem in `draft-angle.js`.
- The geometry pipeline is vector-first: shapes are stored as polygon / multipolygon data and boolean operations are handled through Clipper (`clipper2-ts`) rather than through a raster-mask workflow.
- The Clipper boundary is wrapped through an app-side adapter and the geometry pipeline uses a shared `8`-decimal quantization policy so workplane-generated geometry and boolean operations land on the same coordinate grid.
- The authoring hierarchy is organized as `Drawings` containing `Layers`, and geometry is authored and merged at the layer level.
- The render subsystem is driven by committed `Rbox` records, which are separate from layer-owned render properties and define the render box / render-workspace side of the app rather than the main drawing hierarchy.
- Per-layer render properties are global settings stored on the layer records themselves, not per-render overrides.
- The render/documentation side builds projected output from geometry clipped against the active `Rbox`, combined with the global layer render settings.
- `Plan` intentionally remains a separate architectural branch from the directional render path, even though both now pass through the same top-level render-pane orchestration.
- Project persistence is based on a strict app-native JSON format that saves the real project state rather than a visual snapshot.
- The architecture distinguishes between project-persistent state and runtime/UI-only state so temporary interaction state does not get treated as saved document data.

## Geometry / Units / Coordinate Model

- The canonical stored coordinate space is world space, and `1 world unit = 1 mm`.
- Display units (`mm`, `cm`, `m`) are formatting choices only; changing them does not rescale stored geometry.
- The drafting / workplane is a separate input frame with its own origin and angle; users draw relative to that frame, and committed geometry is converted back into world coordinates.
- Stored shape geometry is polygon / multipolygon data rather than primitive live rectangle / ellipse entities.
- Ellipses are currently persisted as polygon approximations, not as exact analytic curves.
- Square-brush and other authored geometry ultimately enter the same polygon boolean pipeline and are stored in the same geometry model as other merged shapes.
- Workplane-generated coordinates and Clipper boolean coordinates share the same `8`-decimal quantization policy so geometry enters boolean operations on one canonical precision grid.
- Layer geometry is treated as merged vector output rebuilt from the shapes that belong to that layer.

## Grid / Snap Model

- The app has a user-facing cell model that drives visible grid spacing, snapping, rulers, and cell-based draw widths.
- `Grid Snap` has two modes: `Adaptive` and `Locked`.
- In `Adaptive`, the effective minimum cell is fixed to `1 mm`, and the visible grid plus rulers promote from that minimum through a zoom-adaptive `1-2-5` ladder.
- In `Adaptive`, snapping and cell-based draw widths follow the currently promoted visible step rather than a separately stored larger cell.
- In `Locked`, the effective cell comes from the configured `Cell Size` and its chosen display unit (`mm`, `cm`, or `m`); the rendered grid stays fixed to that cell while rulers can still promote adaptively from it.
- In `Locked`, grid tiers fade by screen density instead of promoting to a coarser spacing, so overcrowded lines disappear progressively rather than switching to a new cell size.
- The current default user-facing configuration is `Display Unit = m`, `Grid Snap = Adaptive`, and `Cell Size = 5 cm` as the fallback locked cell.

## Draft-Angle Canonical Model

- `draft-angle.js` owns the draft-angle store, family records, candidate state, active rotation state, lookup-table runtimes, and family/candidate matching logic.
- The active workplane rotation is not modeled as a simple accumulated free-float angle; it is represented as a `family`, `candidate`, or fallback `free` mode plus an integer step identity.
- The default canonical family covers `0..359` degree steps at `1deg` increments.
- The current implementation uses lookup-table coefficients on the shared `8`-decimal grid, and transforms/render framing read the active lookup entry instead of recomputing trig ad hoc.
- Workplane alignment can resolve either to an existing known family or to a temporary candidate family derived from a normalized direction vector.
- A temporary candidate becomes a persistent dynamic family only after a committed draw or subtract operation under that regime; resetting the plane or leaving the regime without a commit discards it.

## Vertex / Outline Provenance Model

- Each stored shape carries `vertexOutlineEligibility` metadata alongside its geometry.
- Straight/corner-authored geometry defaults its vertices to outline-eligible, while ellipse approximation vertices default to outline-ineligible.
- That metadata survives duplicate/import-export/move paths and is propagated through current layer rebuild / boolean flows by coordinate-based provenance matching.
- On the main canvas, outline-ineligible vertices render differently from eligible ones when corner markers are shown, so authored corners remain distinguishable from derived approximation points.
- In directional renders, eligible vertices can contribute outline breaks only when they lie on the visible front profile of the same component.

## State / Persistence Model

- The project uses a strict app-native JSON document model for export/import rather than saving a visual snapshot.
- Persistent project state includes the authored document structure (`drawings`, `layers`, `shapes`), tool/workspace context that is meant to survive reopen, render records, layer-owned render settings, and draft-angle snapshot state.
- Workspace persistence also includes selected UI/context state that is treated as part of the reopenable project experience, such as the active drawing/layer, active workspace tab, current render-workspace memory, and related layout state.
- Runtime/UI-only state is kept separate for temporary interaction flows such as pointer drags, rename drafts, pending draw/transform state, modal-local drafts, and other in-progress editing state that should not be written as document truth.
- Derived geometry data is not trusted as canonical persisted state; for example, shape `bounds` are recomputed on import.
- `Rbox` records are persistent project data, while unfinished `Rbox` authoring state stays runtime-only until a box is actually committed.
- Layer render properties are stored on the layer records themselves and travel through duplicate/import/export with the rest of the document state.
- Whenever a feature adds meaningful project state, its export/import path should be updated as part of the same implementation.
- Backward compatibility for older project-file schemas is currently not a goal when the saved model changes.

## Authoring / Layer Model

- The document hierarchy is `Drawings` containing `Layers`, with one active drawing and one active layer at a time.
- New geometry is always created on the active layer.
- Layer order controls paint order within a drawing, and drawing order controls higher-level canvas ordering across drawings.
- Layers own the main authoring/display properties such as visibility, lock state, fill color, and the global render settings described elsewhere in this file.
- Layer operations are real document operations rather than temporary UI sorting: layers can be reordered, duplicated, deleted, moved across drawings, and merged into another layer.
- The model preserves a valid fallback active drawing/layer when layers or drawings are deleted.

## Workspace Model

- The app has one always-available `Main` workspace for authoring on the live canvas.
- Each committed `Rbox` creates a corresponding render workspace tab; render tabs are therefore driven one-to-one by persistent render records.
- `Add Rbox` does not create an empty render immediately; it arms `Draw > Rbox` on `Main`, and the render record/tab is created only when the box is actually committed.
- `Main` remains the place where geometry and render boxes are authored or transformed; the render tabs are for documentation/render output, not for replacing the main drawing surface.
- The bottom workspace switcher is the main navigation boundary between authoring and render contexts.
- Each `Rbox` keeps its own render-workspace memory, including layout mode, pane-direction choices, and related per-render workspace settings, rather than sharing one global render workspace profile.
- The render workspace supports both embedded use in the main window and one externalized pop-out window for the active `Rbox`, while still treating that pop-out as the same underlying render tab state rather than a separate document.
- `Rbox` card activation in the left panel is distinct from render-tab viewing: card activation is used for `Rbox` transform/editing behavior on `Main`, while workspace tabs control which authoring/render surface is currently open.

## Main Canvas Display Model

- The main canvas render stack separates the always-visible `World` axes from the draft-canvas overlay.
- `World` axes remain visible underneath scene content as the stable world reference, independent from whether the draft canvas is shown.
- The draft canvas (`Grid` plus draft-plane axes) is shown only while `Draw` is active; in `Select`, it is hidden while the `World` axes remain visible.
- In `Draw`, regular layer geometry renders below the draft canvas, and the active layer's emphasized outline/corners are then redrawn on top for readability.
- Layer outlines and corner markers are controlled by global settings, and `Corners` depends on `Outline`.
- The active layer in `Draw` is a deliberate exception: its emphasized drafting outline/corners remain visible even if the general outline/corner settings are off.
- Selection highlighting is drawn by tracing the selected shape geometry.

## Render Subsystem

- The render subsystem starts from a compiled render-scene pass built from current drawings, layer order, merged layer geometry, and the global render settings stored on layers.
- Each render pane resolves a normalized render request against the active `Rbox`, using that box's local frame and clipped scene geometry as the basis for output.
- `Plan` and the directional panes share the same top-level render-pane orchestration, but they do not share the same internal builder/painter contract.
- `Plan` keeps its own plan-specific builder/painter path and currently paints clipped local geometry in the `Rbox` frame using layer fill colors.
- The non-plan directional panes share one common directional documentation/painter path for `Top to Bottom`, `Bottom to Top`, `Left to Right`, and `Right to Left`.
- The directional render path is documentation-first: it builds a vector documentation object from projected/clipped scene geometry, visible-surface winner selection, primary breakpoints, and elevation bands before rasterizing only for preview display.
- Directional depth shading is driven by global render settings (`Depth Effect`, `Depth Strength`) and is applied across the current pane's visible depth range rather than as per-layer manual tinting.
- Directional outlines are also global render settings and are derived from visible mass/silhouette boundaries, depth transitions, and eligible visible profile vertices.
- Render settings and layer render settings are edited as global controls outside individual `Rbox` records, while `Rbox` records own only render-local properties such as box geometry, visibility, and vertical extent.

## Critical Interaction Model

- `Draw` and `Select` are the two main editing modes; drawing creates geometry on the active layer, while selection works on whole merged shapes rather than on unmerged primitive drafts.
- In `Draw`, left click adds geometry and right click uses the current draw shape as subtraction geometry against the active layer's merged vector result.
- New geometry is authored in draft/workplane space and committed into world-space layer geometry, after which the affected layer is rebuilt through the boolean pipeline.
- In `Select`, hit selection and marquee selection both operate against stored merged shapes; multi-selection can be moved together and affected layers are rebuilt after the move.
- Selection marquee direction matters: right-drag selects enclosed shapes only, while left-drag selects enclosed-or-intersecting shapes.
- Holding `Shift` modifies selection membership for both click and marquee interactions instead of replacing the current selection.
- Holding `Space` temporarily suspends the normal draw/select interaction and enters drafting-transforms mode without permanently switching tools.
- While `Space` is held, mouse wheel rotates the active workplane through exact family/candidate step positions, middle drag moves the workplane origin, and left drag aligns the workplane direction from a chosen start point.
- Workplane alignment is magnetic rather than purely freehand: nearby geometry can snap the chosen points, but the resulting direction is still derived from the resolved start/end points and may resolve either to an existing family or to a temporary candidate regime.
- Resetting the workplane restores the world-aligned plane rather than modifying stored geometry; the workplane is an input/render frame, not the canonical geometry itself.
- `Rbox` transform activation on `Main` temporarily suspends regular layer authoring interactions without changing the user's underlying base tool, so render-box editing behaves like its own temporary interaction mode.

## Known Bugs

### 1. Non-Orthogonal Draft-Plane Re-Align / Diagonal Canonicalization Bug

- Status: open.
- Symptom: when the workplane is aligned onto a diagonal shape that was not originally drawn inside that family, newly drawn geometry in the resulting family is not perfectly orthonormal with the original diagonal shape, which can create small misalignments and spurious vertices during boolean interactions.
- Root cause: the current draft-angle family lookup entries quantize stored `cos/sin` coefficients to the shared `8`-decimal precision. That quantization is small in world terms but large enough at Clipper integer scale to make edges that should be exactly parallel or collinear land slightly off.
- Rejected fix path: increasing the collinear simplification epsilon was tested and did not solve this bug in practice.