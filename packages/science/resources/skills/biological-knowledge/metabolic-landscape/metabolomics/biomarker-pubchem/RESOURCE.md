---
name: biomarker-pubchem
description: Access current PubChem compound properties, identifiers, synonyms, assay summaries, and similarity results through its documented PUG-REST API. Use for chemical identity and bioactivity context.
category: biological-knowledge/metabolic-landscape/metabolomics
license: Unknown
metadata:
  access-mode: remote
  database: PubChem
  requires-network: true
---

# PubChem Remote Resource

Read `references/PubChem_ref.md`, then construct a bounded PUG-REST request with the correct input namespace and output operation. Respect PubChem's request-rate policy, use bulk downloads for large jobs, and preserve CID and input namespace.

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/pubchem-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
