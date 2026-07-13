---
name: biomarker-msi-detection
description: "Detect microsatellite instability from sequencing assays, select compatible callers and thresholds, and report MSI-H evidence for oncology and Lynch syndrome."
category: biological-knowledge/clinical-and-phenotype/cancer-biomarkers
license: Mixed
metadata:
  access-mode: hybrid
  database: msi-detection
---

# biomarker-msi-detection

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-msi-detection` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

This package has no bundled MSI database snapshot. The local route satisfies an analysis only when
the required sequencing inputs, reference genome, microsatellite loci, compatible caller, and
assay-specific thresholds are already available locally. Use a documented remote source only for
missing/current reference material or a compatible remote operation; otherwise report the missing
local prerequisite. A script or guide alone is not local MSI evidence.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
