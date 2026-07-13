---
name: biomarker-tumor-mutational-burden
description: "Calculate and interpret tumor mutational burden with assay-aware denominators, germline and artifact filtering, calibration, and oncology reporting criteria."
category: biological-knowledge/clinical-and-phenotype/cancer-biomarkers
license: Mixed
metadata:
  access-mode: hybrid
  database: tumor-mutational-burden
---

# biomarker-tumor-mutational-burden

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-tumor-mutational-burden` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

This package has no bundled TMB reference database. The local route satisfies calculation only
when the somatic variant input, callable territory or validated assay denominator, filtering
rules, and calibration information are available locally. Use documented remote sources only for
missing/current annotation or calibration evidence. A local calculator without its denominator and
assay context is incomplete rather than a valid local result.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
