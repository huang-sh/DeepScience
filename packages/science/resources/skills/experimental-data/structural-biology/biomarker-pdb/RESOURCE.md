---
name: biomarker-pdb
description: Query current RCSB PDB experimental macromolecular structures by four-character PDB ID or bounded full-text search. Use for structure title, experimental method, resolution metadata, and candidate structure discovery.
metadata:
  access-mode: remote
category: experimental-data/structural-biology
---

# RCSB PDB

This Resource is an online connector, not a local archive of PDB or mmCIF coordinate files.

## Workflow

1. Prefer an exact four-character PDB ID when available.
2. Execute an exact lookup or bounded search:

```bash
python3 "<RESOURCE_ROOT>/scripts/query_pdb.py" 1TUP
python3 "<RESOURCE_ROOT>/scripts/query_pdb.py" 'p53 DNA-binding domain' --limit 5
```

3. Verify experimental method, resolution, entity identity, organism, construct, mutations, and ligand state before selecting a structure.
4. Report the PDB ID and access date. Do not treat a text-search score as biological confidence.

Run the script with `--help` for all options.

Database: https://www.rcsb.org/

## Extended capabilities

Use these on-demand guides when their API, schema, batching, or validation detail is relevant:

- `references/pdb-database-guide.md`

Use `catalog.py files` for the exact package file inventory. Bundled clients and executable
examples are under `scripts/`; preserve the package's existing direct query
script when it already covers the request.
