---
name: biomarker-hmdb
description: Access HMDB metabolite records through its documented remote interfaces. Use for HMDB accession lookup and metabolite discovery while reporting browser-protection or licensing failures explicitly.
category: biological-knowledge/metabolic-landscape/metabolomics
license: Unknown
metadata:
  access-mode: remote
  database: HMDB
  requires-network: true
---

# HMDB Remote Resource

Read `references/HMDB_ref.md` and construct a bounded HMDB request for the exact accession or query. HMDB may require browser or licensed access; report that upstream limitation and never silently substitute PubChem or another database.

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/hmdb-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
