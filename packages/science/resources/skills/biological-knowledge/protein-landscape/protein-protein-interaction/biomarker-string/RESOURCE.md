---
name: biomarker-string
description: Query current STRING protein interaction partners and confidence evidence for one or more identifiers. Use for species-specific functional or physical interaction investigation through the bundled bounded online-query script.
metadata:
  access-mode: remote
category: biological-knowledge/protein-landscape/protein-protein-interaction
---

# STRING

This Resource is an online connector, not a local STRING network snapshot.

## Workflow

1. Confirm the organism taxonomy ID and identifier namespace.
2. Execute:

```bash
python3 "<RESOURCE_ROOT>/scripts/query_string.py" TP53,MDM2 --species 9606 --limit 10 --score-threshold 700
```

3. Inspect the combined score and individual evidence channels before interpreting an edge.
4. Distinguish functional association from direct physical interaction and report the query parameters.

Run the script with `--help` for all bounded options.

Database: https://string-db.org/

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/string-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
