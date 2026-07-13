# Azimuth Cell Type Marker Query Reference

- **Version**: Azimuth 2023 (local export)
- **Paper year**: 2020

## Database Overview (for interpretation)

**Azimuth** provides reference atlases and mapping tools for single‑cell datasets. The local file contains tissue‑specific cell type annotations with marker genes and annotation levels.

- **Homepage**: `https://azimuth.hubmapconsortium.org/`
- **Scope**:
  - Tissue‑specific cell type annotations
  - Marker genes per cell type
  - Annotation levels (e.g., L1/L2)

### Paper info (for context)

- **Paper title**: Integrated analysis of multimodal single-cell data
- **Journal**: Cell, 2020

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/Cellular_landscape/cell_type/General-database/resources/`
- **Format**: CSV (comma-separated), header row present.
- **File**:
  - `Azimuth_2023.csv`

## Header Schema

```text
tissue,annotation_level,celltype,marker
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/Cellular_landscape/cell_type/General-database/resources/Azimuth_2023.csv',
)

df = pd.read_csv(file_path)
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **tissue**: Tissue or reference atlas (e.g., PBMC).
- **annotation_level**: Annotation granularity (e.g., L1, L2).
- **celltype**: Cell type label.
- **marker**: Marker gene symbol for the cell type.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `tissue`
- **Step 2 (exact)**: `celltype` / `annotation_level`
- **Step 3 (exact/contains)**: `marker`

## Key Query Columns (关键词查询列)

1. **`tissue`**
2. **`celltype`**
3. **`annotation_level`**
4. **`marker`**
