---
name: biomarker-opentargets
description: Access current Open Targets Platform target, disease, drug, and association records through its documented GraphQL API. Use for target identification, disease context, tractability, and therapeutic hypotheses.
category: biological-knowledge/clinical-and-phenotype/therapeutic-targets
license: Unknown
metadata:
  access-mode: remote
  database: Open Targets Platform
  requires-network: true
---

# Open Targets Remote Resource

Read `references/OpenTargets_ref.md`, use stable Ensembl, EFO, or ChEMBL identifiers, and construct a bounded GraphQL query returning only required fields. Do not use the entity API for bulk extraction. Preserve evidence sources and scores.

Use the package-local CLI for target lookup and ranked disease associations:

```bash
python3 <resource-dir>/scripts/query_opentargets.py search PCSK9 --entity target --limit 5
python3 <resource-dir>/scripts/query_opentargets.py --output opentargets-pcsk9.json associations PCSK9 --limit 5
```

Write `--output` files into the Session workspace. Treat association scores as evidence-ranking
scores, not clinical risk or probability of therapeutic success.

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/opentargets-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
