---
name: biomarker-variant-prioritization
description: "Prioritize rare-disease variants using inheritance, phasing, phenotype similarity, gene-disease validity, mosaic evidence, and secondary-findings guidance."
category: biological-knowledge/clinical-and-phenotype/variants
license: Mixed
metadata:
  access-mode: hybrid
  database: variant-prioritization
---

# biomarker-variant-prioritization

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-variant-prioritization` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

This package has no bundled variant, phenotype, or gene-disease database. The local route satisfies
prioritization only when the annotated variants, inheritance and phasing inputs, phenotype terms,
and dated gene-disease/evidence datasets cover the requested analysis. Use documented remote
sources only for missing/current annotations or evidence, and preserve valid local annotations
rather than replacing them silently.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
