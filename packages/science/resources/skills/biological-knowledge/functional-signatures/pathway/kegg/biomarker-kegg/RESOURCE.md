---
name: biomarker-kegg
description: Query current KEGG pathway entries and gene links, or inspect the bundled KEGG 2026 pathway-to-gene snapshot. Use for pathway lookup, pathway gene membership, reproducible enrichment gene sets, and snapshot-versus-current comparisons.
metadata:
  access-mode: hybrid
category: biological-knowledge/functional-signatures/pathway/kegg
---

# KEGG

## Hybrid coverage gate

Start with `snapshot` when the request is a Homo sapiens pathway-name-to-complete-gene-symbol set
for the bundled KEGG 2026 scope and does not require a current record. A non-empty exact snapshot match satisfies
that request; return it without a KEGG REST call.

Use the live API when the user requests current/live KEGG, supplies or needs a KEGG pathway ID,
requires a non-snapshot organism or namespace, asks for entry metadata, or the local exact match is
empty or lacks required fields. Query both sources only for an explicit snapshot-versus-current
comparison or independent validation, and report them as separate evidence streams.

Available evidence:

- `assets/KEGG/KEGG_2026.txt`: fixed local pathway-to-gene-symbol snapshot for reproducible analysis.
- `scripts/query_kegg.py`: current KEGG REST results for lookup and freshness.

## Online query

```bash
python3 <resource-dir>/scripts/query_kegg.py find "cell cycle" --limit 20 --output kegg-find.json
python3 <resource-dir>/scripts/query_kegg.py info hsa04110 --output kegg-info.json
python3 <resource-dir>/scripts/query_kegg.py genes hsa04110 --organism hsa --output kegg-genes.json
```

`--limit` bounds only `find` search hits. The `genes` operation always returns every gene
link reported for the selected pathway; never truncate, infer, or manually supplement its
membership. The output uses named objects rather than positional row arrays. Read
`references/response-schema.md` before consuming a live or snapshot result; use its field names
directly in the task-level consolidation script.

KEGG `find` commonly returns a species-neutral `mapNNNNN` identifier. For `genes`, the script
normalizes it to the requested organism (for example `map04979` + `--organism hsa` becomes
`hsa04979`) and reports both requested and resolved IDs.

## Local snapshot query

```bash
python3 <resource-dir>/scripts/query_kegg.py snapshot "cholesterol metabolism" \
  --match exact --output kegg-snapshot.json
```

The snapshot operation understands the reserved empty second column and removes trailing empty
fields. Prefer it to ad hoc `grep` or positional parsing. When both evidence streams were requested,
report them separately with their identifier namespaces and exact counts. This Resource branch is complete
when every selected operation has one structured output artifact and the consolidation script can
trace every reported member to its documented named field.

KEGG REST usage is subject to KEGG's academic-use terms.
