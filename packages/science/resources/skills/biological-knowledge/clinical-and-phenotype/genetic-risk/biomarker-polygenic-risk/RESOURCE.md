---
name: biomarker-polygenic-risk
description: "Construct, calibrate, validate, and report ancestry-aware polygenic risk scores using public score catalogs and established PRS methods."
category: biological-knowledge/clinical-and-phenotype/genetic-risk
license: Mixed
metadata:
  access-mode: hybrid
  database: polygenic-risk
---

# biomarker-polygenic-risk

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-polygenic-risk` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

This package has no bundled score catalog or LD reference. The local route satisfies scoring only
when genotypes, the exact score weights and genome build, allele harmonization metadata, required
LD reference, and calibration context are available locally. Use the documented remote catalog
when the score, metadata, or requested current release is missing; then cache and version the
retrieved material before calculation.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
