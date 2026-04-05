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

- Last updated: 2026-04-06 02:12 EEST
- Latest change: revised `Core Architecture`.

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
- The canonical units model is `1 world unit = 1 mm`; stored geometry stays in that unit and display units are a formatting layer on top.
- The drafting / workplane can move and rotate independently from stored geometry, and its angle-family logic is handled through the draft-angle subsystem in `draft-angle.js`.
- The geometry pipeline is vector-first: shapes are stored as polygon / multipolygon data and boolean operations are handled through Clipper (`clipper2-ts`) rather than through a raster-mask workflow.
- The authoring hierarchy is organized as `Drawings` containing `Layers`, and geometry is authored and merged at the layer level.
- The documentation side is built as a separate render workspace driven by `Rbox` records; from there the app produces projected render outputs from clipped geometry plus the per-layer height / render settings.
- Project persistence is based on a strict app-native JSON format that saves the real project state rather than a visual snapshot.
