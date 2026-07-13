---
name: biomarker-ensembl
description: Query current Ensembl gene, transcript, coordinate, biotype, and stable-identifier records by symbol or Ensembl ID. Use when a task requires organism-specific genome annotation through the bundled online-query script.
metadata:
  access-mode: remote
category: biological-knowledge/dna-genome/gene-annotation
---

# Ensembl

This Resource is an online connector, not a local Ensembl snapshot. Results depend on the current Ensembl release.

## Workflow

1. Confirm species and whether the input is a symbol or stable ID.
2. Execute:

```bash
python3 "<RESOURCE_ROOT>/scripts/query_ensembl.py" TP53 --species homo_sapiens --expand
```

3. Verify assembly, coordinates, strand, biotype, and transcript identifiers.
4. Preserve the original identifier and report any conversion.

Use `--no-expand` for a compact record. Run the script with `--help` for all options.

Database: https://www.ensembl.org/

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/bio-ensembl-rest-guide.md`
- `references/ensembl-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
