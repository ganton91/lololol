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

- Last updated: 2026-04-06 02:42 EEST
- Latest change: added state model section.

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
