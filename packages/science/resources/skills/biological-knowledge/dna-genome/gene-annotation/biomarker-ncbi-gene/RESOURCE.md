---
name: biomarker-ncbi-gene
description: Query current NCBI Gene records by symbol, Gene ID, organism, or search expression. Use for gene summaries, aliases, nomenclature, chromosome and map location, genomic coordinates, and identifier verification through NCBI E-utilities.
metadata:
  access-mode: remote
category: biological-knowledge/dna-genome/gene-annotation
---

# NCBI Gene

This Resource is an online connector, not a local NCBI Gene snapshot.

## Workflow

1. Specify the organism whenever the query is not already a numeric Gene ID.
2. Execute:

```bash
python3 "<RESOURCE_ROOT>/scripts/query_ncbi_gene.py" TP53 --organism human --limit 5
```

3. Verify the returned Gene ID, organism, aliases, chromosome, map location, and genomic coordinates.
4. Preserve identifiers and report the access date. Treat a missing record as missing evidence, not proof of absence.

Run the script with `--help` for all options.

Database: https://www.ncbi.nlm.nih.gov/gene/

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/gene-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
