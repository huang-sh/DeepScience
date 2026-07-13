# 3CA Cancer Cell Metaprogram Query Reference

- **Version**: 3CA (Curated Cancer Cell Atlas)
- **Paper year**: 2023

## Database Overview (for interpretation)

This resource summarizes **meta-programs** (co-regulated gene sets) identified from the Curated Cancer Cell Atlas (3CA) study of transcriptional intratumour heterogeneity. It provides metaprogram–gene mappings for malignant cancer cells and for major non-malignant cell types.

- **Homepage**: `https://www.weizmann.ac.il/sites/3CA/`
- **Scope**:
  - Cancer (malignant) cell metaprograms
  - Normal (non‑malignant) cell metaprograms
  - Metaprogram gene members and descriptions

### Paper info (for context)

- **Paper title**: Hallmarks of transcriptional intratumour heterogeneity across a thousand tumours
- **Journal**: Nature, 2023
- **DOI**: 10.1038/s41586-023-06130-4

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/functional_signatures/program/cancer_cell_metaprogram/resources/3CA/`
- **Format**: CSV (comma-separated), header row present.
- **Files**:
  - `3ca.cancer_cell.mp.csv`
  - `3ca.normal_cell.mp.csv`

## Header Schema

### 3ca.cancer_cell.mp.csv

```text
celltype,metaprogram_id,metaprogram_description,url,gene
```

### 3ca.normal_cell.mp.csv

```text
celltype,metaprogram_description,gene
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/functional_signatures/program/cancer_cell_metaprogram/resources/3CA/3ca.cancer_cell.mp.csv',
)

df = pd.read_csv(file_path)
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

### 3ca.cancer_cell.mp.csv

- **celltype**: Cell category (malignant cancer cells).
- **metaprogram_id**: Meta-program identifier.
- **metaprogram_description**: Meta-program label.
- **url**: Link to the gene set in MSigDB.
- **gene**: Gene symbol in the metaprogram.

### 3ca.normal_cell.mp.csv

- **celltype**: Non‑malignant cell type (e.g., macrophages).
- **metaprogram_description**: Meta-program label.
- **gene**: Gene symbol in the metaprogram.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `metaprogram_id` (cancer) / `metaprogram_description`
- **Step 2 (exact)**: `celltype`
- **Step 3 (exact)**: `gene`
- **Step 4 (contains)**: `url`

## Key Query Columns (关键词查询列)

1. **`metaprogram_id`** (cancer)
2. **`metaprogram_description`**
3. **`celltype`**
4. **`gene`**
5. **`url`**
