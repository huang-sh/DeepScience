# PanglaoDB Marker Query Reference

- **Version**: PanglaoDB markers (2020-03-27 export)
- **Paper year**: 2019

## Database Overview (for interpretation)

**PanglaoDB** is a web server for exploring human and mouse scRNA‑seq data and provides a community‑curated cell‑type marker compendium. The local file contains marker gene–cell type associations with specificity and sensitivity metrics.

- **Homepage**: `https://panglaodb.se/`
- **Scope**:
  - Human and mouse cell‑type markers
  - Marker specificity/sensitivity metrics
  - Tissue/organ annotations

### Paper info (for context)

- **Paper title**: PanglaoDB: a web server for exploration of mouse and human single-cell RNA sequencing data
- **Journal**: Database, 2019
- **DOI**: 10.1093/database/baz046

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/Cellular_landscape/cell_type/General-database/resources/`
- **Format**: TSV (tab-separated), header row present.
- **File**:
  - `PanglaoDB_markers_27_Mar_2020.tsv`

## Header Schema

```text
species\tofficial gene symbol\tcell type\tnicknames\tubiquitousness index\tproduct description\tgene type\tcanonical marker\tgerm layer\torgan\tsensitivity_human\tsensitivity_mouse\tspecificity_human\tspecificity_mouse
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/Cellular_landscape/cell_type/General-database/resources/PanglaoDB_markers_27_Mar_2020.tsv',
)

df = pd.read_csv(file_path, sep='\t')
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **species**: Species tags (Hs, Mm or both).
- **official gene symbol**: Official gene symbol.
- **cell type**: Cell type label.
- **nicknames**: Alternative gene symbols.
- **ubiquitousness index**: Expression ubiquity score.
- **product description**: Gene product description.
- **gene type**: Gene type/biotype.
- **canonical marker**: Canonical marker flag (1/0).
- **germ layer**: Germ layer annotation.
- **organ**: Organ/tissue annotation.
- **sensitivity_human / sensitivity_mouse**: Sensitivity in human/mouse.
- **specificity_human / specificity_mouse**: Specificity in human/mouse.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `cell type`
- **Step 2 (exact)**: `official gene symbol`
- **Step 3 (exact)**: `organ` / `germ layer`
- **Step 4 (exact/contains)**: `species`

## Key Query Columns (关键词查询列)

1. **`cell type`**
2. **`official gene symbol`**
3. **`organ`**
4. **`germ layer`**
5. **`species`**
