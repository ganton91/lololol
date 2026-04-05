# AI Memories V2

## Rules

Important: the following rules should always be read and remain in effect throughout the whole session.

### Maintenance Rules

- Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes, and update the relevant section immediately when a feature changes the way the program works.
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

- Last updated: 2026-04-06
- Latest change: created and started shaping `AI Memories V2` as a slimmer onboarding-focused replacement for the original `AI Memories`.
