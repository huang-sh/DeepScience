---
name: biomarker-blast
description: "Run remote NCBI BLAST or local BLAST+ searches, select programs and databases, build custom databases, and retrieve reproducible sequence-similarity results."
category: biological-knowledge/dna-genome/sequence-similarity/blast
license: Mixed
metadata:
  access-mode: hybrid
  database: blast
---

# biomarker-blast

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-blast` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

Run local BLAST first when BLAST+, the requested local database, its version/date, and all query
sequences are available and that database covers the requested search space. Use remote NCBI BLAST
when the required database is absent, the user requests the current NCBI corpus, or local coverage
is insufficient. Query both only for explicit validation; keep database names, versions, search
parameters, and results separate.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
