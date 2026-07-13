---
name: biomarker-proteomics-data
description: "Find and evaluate public proteomics datasets in ProteomeXchange, MassIVE, and related repositories by species, instrument, protocol, accession, and modification."
category: experimental-data/proteomics
license: Mixed
metadata:
  access-mode: remote
  database: proteomics-data
---

# biomarker-proteomics-data

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-proteomics-data` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Treat this package as `remote`: a missing local snapshot does not make a documented
   remote source unavailable. Follow the selected guide's API, CLI, installation, authentication,
   rate-limit, and version requirements.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
