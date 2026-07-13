---
name: reproducible-research
description: Plan and execute reproducible computational research with explicit inputs, environments, provenance, deterministic steps, validation, and workspace outputs. Use for analyses that must be rerun, audited, or handed to another researcher.
category: research
---

# Reproducible Research

Use this workflow whenever a scientific result must be traceable from inputs to conclusions.

## Workflow

1. Inspect the workspace before changing it. Identify source data, existing scripts, environment files, and prior outputs.
2. State the research question, expected deliverables, assumptions, and acceptance criteria.
3. Preserve raw inputs. Write derived data and generated files to clearly named output directories.
4. Record software versions, parameters, random seeds, data filters, and commands needed to reproduce the result.
5. Prefer a reusable script or notebook over an undocumented sequence of shell commands.
6. Validate intermediate outputs: dimensions, missingness, ranges, identifiers, and invariant checks.
7. Separate observation from interpretation. Link every reported conclusion to an output file, table, figure, or test.
8. Return a compact run summary containing inputs, methods, validation results, limitations, and exact output paths.

## Required Output

- A machine-readable or scripted analysis workflow
- Generated results inside the current workspace
- A concise provenance record
- Explicit warnings for incomplete, inferred, or unvalidated results

Never claim that a computation ran unless its command or tool result confirms completion.
