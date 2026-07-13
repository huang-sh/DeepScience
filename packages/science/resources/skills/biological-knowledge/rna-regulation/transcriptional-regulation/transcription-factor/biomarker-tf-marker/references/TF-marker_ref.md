# TF-Marker Query Reference

- **Version**: TF-Marker (Nucleic Acids Research, 2022)
- **Paper year**: 2021 (accepted), 2022 (database issue)

## Database Overview (for interpretation)

**TF-Marker** is a manually curated database of transcription factors (TFs) and related markers for specific human cell and tissue types. Entries are grouped into five functional categories: TF, T Marker, I Marker, TFMarker, and TF Pmarker. The resource links each marker to literature evidence and metadata on cell/tissue context and experiments.

**Designed for**: literature-backed TF / marker evidence with cell/tissue context (human).  
**Interpretation limits**: not an exhaustive TF list; a gene can appear multiple times (many rows) across contexts; absence ≠ “not a TF”.

### Category definitions

- **TF**: TFs that regulate the expression of markers (e.g., a TF directly controls marker gene expression).
- **T Marker**: Markers regulated by TFs (downstream targets of TFs).
- **I Marker**: Markers that influence TF activity (upstream modulators of TFs).
- **TFMarker**: TFs that also function as cell/tissue markers (cell/tissue-specific TF markers).
- **TF Pmarker**: TFs that serve as potential/putative markers (suggestive evidence as markers).

## How to use TF-Marker for different questions (关键：不要把 T Marker / I Marker 当成 TF)

TF-Marker is **category-typed**. When the user asks “哪些 gene 是转录因子 / is X a TF?”, TF-Marker should only contribute evidence from categories that are **explicitly TF**:

- TF evidence categories in TF-Marker:
  - `TF` → file `TF.txt`
  - `TFMarker` → file `TFMarker.txt`
  - `TF Pmarker` → file `TF_Pmarker.txt`
- Non-TF categories (do not count as TF):
  - `T Marker` → file `T_Marker.txt` (downstream marker genes regulated by TFs)
  - `I Marker` → file `I_Marker.txt` (upstream modulators of TF activity)

Task mapping (recommended):

- “Is gene X a TF?” / “Which genes in gene set S are TFs?”
  - Query only: `TF.txt`, `TFMarker.txt`, `TF_Pmarker.txt` (exact `Gene Name == X`)
  - Report as: “TF evidence in TF-Marker (category = TF/TFMarker/TF Pmarker)”
- “What marker genes are regulated by TFs?”
  - Use: `T_Marker.txt` (exact `Gene Name` or `Interacting Gene`, depending on the question)
- “What genes influence TF activity (upstream modulators)?”
  - Use: `I_Marker.txt`

- **Homepage**: `http://bio.liclab.net/TF-Marker/`
- **Scope**:
  - Human TFs and related markers
  - Cell and tissue specificity annotations
  - Literature-backed evidence per entry (PMID)

### Paper info (for context)

- **Paper title**: TF-Marker: a comprehensive manually curated database for transcription factors and related markers in specific cell and tissue types in human
- **Journal**: Nucleic Acids Research, 2022
- **DOI**: 10.1093/nar/gkab1114

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/TF-marker/`
- **Format**: CSV (comma-separated; stored as `.txt`), header row present.
- **Files**:
  - `TF.txt`
  - `T_Marker.txt`
  - `I_Marker.txt`
  - `TFMarker.txt`
  - `TF_Pmarker.txt`

## Recommended outputs (to avoid common mistakes)

### 1) TF presence check (gene-level; 推荐用于 “哪些 gene 是 TF?”)

When answering “is X a TF?” / “which genes in gene set S are TFs?” using TF-Marker, the recommended approach is **gene-level evidence flags** (not row counts):

- `TF_Marker_TF` = gene appears in `TF.txt`
- `TF_Marker_TFMarker` = gene appears in `TFMarker.txt`
- `TF_Marker_TF_Pmarker` = gene appears in `TF_Pmarker.txt`
- `TF_Marker_Any_TF` = OR of the three flags above

**Important**: TF-Marker tables are context-rich and often contain many rows per gene (multiple tissues/cell types/PMIDs). For “TF list” questions, report **unique genes** (`nunique` on `Gene Name`) and optionally include evidence row counts separately as `*_EvidenceRows`.

### 2) Sanity checks (快速自检；防止把 TF_Pmarker 用错/漏掉)

- **Do not infer `TF_Pmarker` from `TFMarker`**: `TFMarker.txt` and `TF_Pmarker.txt` are different categories and must be loaded separately.
- **File vs label gotcha**:
  - File name: `TF_Pmarker.txt` (underscore)
  - `Gene Type` value inside file: `TF Pmarker` (space)
- Quick validation:
  - `TFMarker.txt` → `Gene Type` should be **only** `TFMarker`
  - `TF_Pmarker.txt` → `Gene Type` should be **only** `TF Pmarker`
  - If both files show the same `Gene Type`, you likely loaded the wrong file.

## Header Schema

All files share the same schema:

```text
PMID,Gene Name,Gene Type,Cell Name,Cell Type,Tissue Type,Experiment Type,Experimental Method,Title,Description of Gene,Interacting Gene,CellOntologyID
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/TF-marker/TF.txt',
)

df = pd.read_csv(file_path)
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **PMID**: PubMed identifier supporting the entry.
- **Gene Name**: Gene symbol for TF or marker.
- **Gene Type**: One of `TF`, `T Marker`, `I Marker`, `TFMarker`, `TF Pmarker`.
- **Cell Name**: Cell name as reported in the source.
- **Cell Type**: Cell type category (e.g., cancer cell).
- **Tissue Type**: Tissue category.
- **Experiment Type**: Throughput level or experiment class.
- **Experimental Method**: Methods used (semicolon-separated).
- **Title**: Publication title.
- **Description of Gene**: Curated summary description.
- **Interacting Gene**: Reported interacting gene(s) (semicolon-separated).
- **CellOntologyID**: Cell Ontology ID if available (may be empty).

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `Gene Name`
- **Step 2 (exact)**: `Gene Type` / `Cell Name` / `Cell Type`
- **Step 3 (exact)**: `Tissue Type`
- **Step 4 (contains)**: `Title` / `Description of Gene` / `Experimental Method`

## Key Query Columns (关键词查询列)

1. **`Gene Name`**
2. **`Gene Type`**
3. **`Cell Name`** / **`Cell Type`**
4. **`Tissue Type`**
5. **`PMID`**
6. **`Interacting Gene`**
