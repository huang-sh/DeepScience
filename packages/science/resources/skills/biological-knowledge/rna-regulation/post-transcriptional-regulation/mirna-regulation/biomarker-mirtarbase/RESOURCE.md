---
name: biomarker-mirtarbase
description: "Use the bundled miRTarBase biomarker resource for miRTarBase (SE_R), miRTarBase (SE_W), miRTarBase (SE_WR). Discover and read 5 local reference/data files on demand without loading the full collection into context."
category: biological-knowledge/rna-regulation/post-transcriptional-regulation/mirna-regulation
license: Unknown
metadata:
  access-mode: local
  database: "miRTarBase"
  collection: biomarker
  local-files: 5
  generated-from: resource_tree.json
---

# miRTarBase Local Biomarker Resource

## Overview

Use DeepScience's bundled miRTarBase collection for tasks involving miRTarBase (SE_R), miRTarBase (SE_W), miRTarBase (SE_WR). This skill describes how to discover and read the local snapshot; it does not preload database contents.

## When to Use This Skill

Load this skill when a task needs miRTarBase data or falls under **RNA Regulation / Post-transcriptional Regulation / miRNA Regulation**. Prefer the bundled snapshot for reproducible offline analysis. Use the official database only when the task requires newer records or functionality absent from the local files.

## Available Content

- miRTarBase (SE_R)
- miRTarBase (SE_W)
- miRTarBase (SE_WR)

## Local Data

- **Data directory:** `packages/science/resources/skills/biological-knowledge/rna-regulation/post-transcriptional-regulation/mirna-regulation/biomarker-mirtarbase/assets/miRTarBase`
- **Reference directory:** `packages/science/resources/skills/biological-knowledge/rna-regulation/post-transcriptional-regulation/mirna-regulation/biomarker-mirtarbase/references`
- **Indexed local files:** 5
- **Combined size:** 8.33 MiB
- **Formats:** .csv, .md

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

- **Database website:** https://mirtarbase.cuhk.edu.cn/~miRTarBase/miRTarBase_2025
- **Citation:** https://doi.org/10.1093/nar/gkae1072

## Collection Provenance

This Skill was generated from DeepScience's `packages/science/resources/resource_tree.json` catalog. The local data snapshot is stored under `packages/science/resources/biomarker` and is loaded only when the agent explicitly selects this Skill and reads the referenced files.
