---
name: biomarker-uniprot
description: Query current UniProtKB protein annotations by gene, accession, organism, or UniProt expression. Use for protein function, GO terms, domains, pathways, sequence metadata, and identifier verification through the bundled online-query script.
metadata:
  access-mode: remote
category: biological-knowledge/protein-landscape/protein-annotation
---

# UniProtKB

This Resource is an online connector, not a local UniProt snapshot. Results can change with UniProt releases.

## Workflow

1. Confirm the organism and identifier namespace.
2. Run the bounded query script using the absolute Resource root returned by the `resource` tool:

```bash
python3 "<RESOURCE_ROOT>/scripts/query_uniprot.py" TP53 --organism 9606 --limit 5
```

3. Inspect the returned accessions, organism, evidence, and annotations before using them.
4. Save derived tables outside this Resource directory and report the query, accession, and access date.

Use `--organism '*'` only when cross-species results are intended. Run the script with `--help` for all options.

Database: https://www.uniprot.org/

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/bio-uniprot-access-guide.md`
- `references/uniprot-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
