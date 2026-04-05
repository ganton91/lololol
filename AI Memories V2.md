# AI Memories V2

## Rules

This section keeps only:
- rules for maintaining this file
- behavior/process rules for the AI
- export-import rules that the AI must follow
- task-handling rules for active work

It does not describe how the app itself works.

### Maintenance Rules

- Keep this file updated automatically whenever the application's behavior, architecture, dependencies, or active task changes.
- Use clear headings.
- Preserve existing decisions unless they were replaced.
- This file should describe the real current behavior of the app, not plans disguised as facts.
- When a feature changes the way the program works, update the relevant architecture or behavior section immediately.

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
