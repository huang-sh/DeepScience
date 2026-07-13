---
name: biomarker-remote-homology
description: "Detect distant protein homologs using iterative profiles, HMMs, fast sequence search, and structure-aware Foldseek workflows when standard BLAST is insufficient."
category: biological-knowledge/protein-landscape/protein-homology
license: Mixed
metadata:
  access-mode: hybrid
  database: remote-homology
---

# biomarker-remote-homology

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-remote-homology` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

Run the local route first when the selected sequence/profile/structure search program and its
required target database are installed locally and the database release covers the requested
search. Use a documented remote service when the target database or algorithm is unavailable
locally, or when the user requires the service's current corpus. Query both only for explicit
cross-method validation and preserve tool/database provenance separately.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
