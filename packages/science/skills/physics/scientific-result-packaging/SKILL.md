---
name: scientific-result-packaging
description: Package agent-generated scientific code, figures, tables, data, logs, and conclusions into a navigable workspace result with stable paths and a concise manifest. Use near the end of computational tasks.
category: presentation
---

# Scientific Result Packaging

Use this workflow after analysis to make results easy to inspect in the DeepScience workspace.

## Recommended Layout

```text
results/
  README.md
  manifest.json
  figures/
  tables/
  data/
  code/
  logs/
```

Adapt the layout to the project instead of creating duplicate directory trees.

## Workflow

1. Identify the final code, figures, tables, derived data, logs, and narrative conclusions.
2. Use descriptive, stable filenames. Avoid names such as `final2`, `new`, or `test`.
3. Keep raw inputs separate from derived outputs.
4. Write a `README.md` explaining the question, execution entry point, environment, outputs, and known limitations.
5. Write `manifest.json` with each artifact's relative path, type, description, originating step, and creation time when known.
6. Verify every path in the README and manifest exists.
7. Mention the most important workspace paths in the final response so the UI can render or link them.

Do not move or overwrite user files merely to enforce this layout. Package only files created or intentionally updated by the current task.
