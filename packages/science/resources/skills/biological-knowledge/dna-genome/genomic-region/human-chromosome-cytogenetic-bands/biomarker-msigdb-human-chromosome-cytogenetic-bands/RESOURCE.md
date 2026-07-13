---
name: biomarker-msigdb-human-chromosome-cytogenetic-bands
description: "Use the bundled msigdb C1: Positional gene sets biomarker resource for DNA & Genome, Genomic region, human chromosome cytogenetic bands. Discover and read 2 local reference/data files on demand without loading the full collection into context."
category: biological-knowledge/dna-genome/genomic-region/human-chromosome-cytogenetic-bands
license: Unknown
metadata:
  access-mode: local
  database: "msigdb"
  collection: biomarker
  local-files: 2
  generated-from: resource_tree.json
---

# msigdb C1: Positional gene sets Local Biomarker Resource

## Overview

Use DeepScience's bundled msigdb C1: Positional gene sets collection for tasks involving DNA & Genome, Genomic region, human chromosome cytogenetic bands. This skill describes how to discover and read the local snapshot; it does not preload database contents.

## When to Use This Skill

Load this skill when a task needs msigdb C1: Positional gene sets data or falls under **DNA & Genome / Genomic region / human chromosome cytogenetic bands**. Prefer the bundled snapshot for reproducible offline analysis. Use the official database only when the task requires newer records or functionality absent from the local files.

## Available Content

- Curated msigdb C1: Positional gene sets material in the DNA & Genome / Genomic region / human chromosome cytogenetic bands collection

## Local Data

- **Data directory:** `packages/science/resources/skills/biological-knowledge/dna-genome/genomic-region/human-chromosome-cytogenetic-bands/biomarker-msigdb-human-chromosome-cytogenetic-bands/assets`
- **Indexed local files:** 2
- **Combined size:** 0.90 MiB
- **Formats:** .gmt, .json

Paths are relative to the DeepScience repository root. Treat everything under `packages/science/resources` as read-only source data.

## Required Workflow

1. Confirm that this database and category match the scientific question.
2. Use the exact file inventory supplied by the biomarker router for this package; select only files matching the requested entity and format.
3. Inspect metadata, README, and reference files before interpreting a data table.
4. Use `read` with `offset` and `limit` to inspect headers and small slices. Do not load a large file in full.
5. Use `grep` for targeted identifiers or terms. For structured filtering or aggregation, write analysis code outside the resource directory.
6. Record the exact source path, database name, and relevant citation in the result.

## File Handling Guidance

- CSV/TSV: inspect the header first, verify delimiters and identifier columns, then parse with pandas, Polars, R, or command-line tools.
- JSON/GMT/BED/FASTA/text: verify the schema or format from the bundled reference documentation before analysis.
- Shared files may be indexed by more than one resource Skill. Do not duplicate or modify them.
- Absence from the local snapshot is not evidence that a biological association does not exist.
- Check organism, genome build, identifier namespace, database version, and evidence level before combining datasets.

## Reproducibility

Report the local file paths used, filtering logic, row counts before and after filtering, and any identifier conversions. Keep generated tables, plots, and transformed datasets in the session workspace rather than beside the bundled resources.

## References

- **Database website:** https://www.gsea-msigdb.org/gsea/msigdb/human/collections.jsp

## Collection Provenance

This Skill was generated from DeepScience's `packages/science/resources/resource_tree.json` catalog. The local data snapshot is stored under `packages/science/resources/biomarker` and is loaded only when the agent explicitly selects this Skill and reads the referenced files.
