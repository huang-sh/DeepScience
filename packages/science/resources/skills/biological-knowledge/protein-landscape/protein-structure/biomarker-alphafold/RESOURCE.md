---
name: biomarker-alphafold
description: Access current AlphaFold Protein Structure Database predictions and annotations through its documented API. Use for predicted structure URLs and confidence metadata by UniProt accession.
category: biological-knowledge/protein-landscape/protein-structure
license: Unknown
metadata:
  access-mode: remote
  database: AlphaFold DB
  requires-network: true
---

# AlphaFold DB Remote Resource

Read `references/AlphaFold_ref.md`, then construct a bounded API request using an exact UniProt accession. Prediction records may expose coordinate and confidence-file URLs. Treat pLDDT and PAE as confidence, not experimental validation.

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/alphafold-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
