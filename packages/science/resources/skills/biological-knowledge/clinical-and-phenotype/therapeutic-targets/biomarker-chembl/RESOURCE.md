---
name: biomarker-chembl
description: Access current ChEMBL molecules, targets, and bioactivity records through its documented REST API. Use for compound annotation, target discovery, and target-specific activity lookup.
category: biological-knowledge/clinical-and-phenotype/therapeutic-targets
license: Unknown
metadata:
  access-mode: remote
  database: ChEMBL
  requires-network: true
---

# ChEMBL Remote Resource

Read `references/ChEMBL_ref.md`, then construct a bounded request to the documented ChEMBL REST API with available tools. Preserve ChEMBL identifiers and activity units; do not compare assay values without checking assay type and conditions. Save the raw response and derived results in the session workspace.

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/chembl-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
