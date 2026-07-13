# Cell type (General databases) — References (Summary)

Module: `biomarker/Cellular_landscape/cell_type/General-database`

This folder documents the general-purpose cell-type marker resources under `../resources/`.

## Reference files (detailed schemas)

- [`Azimuth_ref.md`](./Azimuth_ref.md)
- [`CellMarker_ref.md`](./CellMarker_ref.md)
- [`PanglaoDB_ref.md`](./PanglaoDB_ref.md)
- [`singleCellBase_ref.md`](./singleCellBase_ref.md)
- [`references.md`](./references.md) (citations index)

## Local resources

- `../resources/Azimuth_2023.csv`
- `../resources/Cell_marker_All.csv`
- `../resources/PanglaoDB_markers_27_Mar_2020.tsv`
- `../resources/singleCellBase_20230904_ALL.csv`

**Default general set rule**: unless the user explicitly narrows scope to a specific file/database, general cell-type marker queries should query **all four resources above together** and report per-database hit/empty status.

## Quick selection (按任务选库)

| Task | Use | Key fields |
|---|---|---|
| “Given a gene, which cell types is it a marker for?” | CellMarker / PanglaoDB / singleCellBase / Azimuth (default all four) | `Symbol/marker`, `official gene symbol`, `gene_symbol`, `marker` |
| “Given a cell type, what markers are reported?” | CellMarker / PanglaoDB / singleCellBase / Azimuth (default all four) | `cell_type`, `cell type`, `cell_type`, `celltype` |
| “Need tissue context / disease-normal tags / evidence metadata” | CellMarker / singleCellBase | `tissue_type`, `cancer_type`, `PMID`, `pubmed_id`, `geo_id` |
| “Need an atlas-style tissue + annotation-level marker list” | Azimuth | `tissue`, `annotation_level`, `celltype`, `marker` |

Note: These resources are not guaranteed exhaustive; absence of a (cell type, marker) pair is not evidence of absence in biology.

## Azimuth (local export 2023)

- **Designed for**: tissue-specific cell type annotations with marker genes and annotation levels (L1/L2).
- **Local file**: `../resources/Azimuth_2023.csv`
- **Format/schema**: CSV with `tissue, annotation_level, celltype, marker`.
- **Typical queries**:
  - Markers for a cell type in a given tissue: filter by `tissue` + `celltype`.
  - Cell types for a marker: filter by `marker` (exact gene symbol).
- **Interpretation limits**: marker lists are atlas/annotation-dependent; use `annotation_level` to control granularity.

## CellMarker 2.0

- **Designed for**: manually curated human/mouse tissue–cell type–marker associations with evidence metadata.
- **Local file**: `../resources/Cell_marker_All.csv`
- **Key fields**: `species`, `tissue_type`, `cancer_type`, `cell_type`, `marker`/`Symbol`, `PMID`, `marker_source`.
- **Typical queries**:
  - Markers for a cell type: filter `species` + `tissue_type` + `cell_type`.
  - Where a gene is a marker: filter `Symbol == <GENE>`.
- **Interpretation limits**: many descriptive columns are for context (e.g., `Title`, `journal`, `technology_seq`) and usually should not be used as primary filters unless requested.

## PanglaoDB markers (2020-03-27 export)

- **Designed for**: scRNA-seq cell-type marker compendium with organ/germ-layer context and specificity/sensitivity metrics.
- **Local file**: `../resources/PanglaoDB_markers_27_Mar_2020.tsv`
- **Format/schema**: TSV with columns such as `species`, `official gene symbol`, `cell type`, `organ`, `germ layer`, and specificity/sensitivity fields.
- **Typical queries**:
  - Markers for a cell type (and organ): filter `cell type` + optional `organ`.
  - Cell types for a marker: filter `official gene symbol == <GENE>`.
- **Interpretation limits**: metrics are species-specific; be explicit about `species` (Hs/Mm/both).

## singleCellBase (2023-09-04 export)

- **Designed for**: curated multi-species cell type marker genes with taxonomy + tissue/sample + publication metadata.
- **Local file**: `../resources/singleCellBase_20230904_ALL.csv`
- **Key fields**: `species`, `cell_type`, `gene_symbol`, `cell_subtype`, `tissue_type`, `pubmed_id`, `geo_id`.
- **Typical queries**:
  - Markers for a cell type/subtype: filter `cell_type` + optional `cell_subtype`.
  - Where a gene appears: filter `gene_symbol` (note: may contain lists; confirm encoding in the file before exact matching).
- **Interpretation limits**: multi-species taxonomy fields are present; always confirm the target `species`.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
