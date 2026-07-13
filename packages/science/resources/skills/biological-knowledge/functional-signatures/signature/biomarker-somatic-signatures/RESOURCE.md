---
name: biomarker-somatic-signatures
description: "Extract, assign, and interpret COSMIC somatic mutational signatures across SBS, DBS, indel, copy-number, and structural-variant profiles."
category: biological-knowledge/functional-signatures/signature
license: Mixed
metadata:
  access-mode: hybrid
  database: somatic-signatures
---

# biomarker-somatic-signatures

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-somatic-signatures` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

This package has no bundled COSMIC signature matrices. The local route satisfies extraction or
fitting only when the mutation catalog, genome build, compatible software, and exact signature
reference release are available locally. Retrieve a documented remote/current reference only when
the local reference is absent or does not cover the requested SBS, DBS, indel, copy-number, or SV
branch. Report reference releases separately when comparison is requested.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
