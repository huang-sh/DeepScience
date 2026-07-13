---
name: biomarker-clinpgx
description: "Query ClinPGx, CPIC, DPWG, and related pharmacogenomic evidence and translate star alleles into phenotypes and genotype-guided prescribing guidance."
category: biological-knowledge/clinical-and-phenotype/pharmacogenomics
license: Mixed
metadata:
  access-mode: remote
  database: clinpgx
---

# biomarker-clinpgx

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-clinpgx` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Treat the bundled scripts as API clients, not local database content. Query the documented
   ClinPGx, CPIC, DPWG, or PharmGKB source and follow its authentication, rate-limit, licensing, and
   version requirements. Reuse an existing workspace response only when its source, query, release
   or retrieval date, and required fields match the request.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
