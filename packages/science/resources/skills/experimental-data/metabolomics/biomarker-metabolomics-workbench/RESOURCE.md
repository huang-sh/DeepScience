---
name: biomarker-metabolomics-workbench
description: Access current Metabolomics Workbench studies, compounds, RefMet names, genes, and proteins through its documented REST API. Use for metabolomics study metadata and metabolite identifier lookup.
category: experimental-data/metabolomics
license: Unknown
metadata:
  access-mode: remote
  database: Metabolomics Workbench
  requires-network: true
---

# Metabolomics Workbench Remote Resource

Read `references/metabolomics_workbench_ref.md` and the module overview, then construct a bounded REST request using the appropriate study, compound, RefMet, gene, or protein context. Use exact identifiers or metabolite names and preserve returned namespaces.

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/metabolomics-workbench-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
