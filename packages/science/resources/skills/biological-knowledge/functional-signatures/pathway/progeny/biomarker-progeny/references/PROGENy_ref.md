# PROGENy Query Reference

- **Version**: PROGENy (Pathway RespOnsive GENes)
- **Paper year**: 2018

## Database Overview (for interpretation)

**PROGENy** is a pathway activity inference method based on perturbation‑response gene signatures. The local files provide pathway–gene weight tables for human and mouse.

- **Project page**: `https://saezlab.github.io/progeny/`
- **Scope**:
  - Pathway–gene weights with adjusted P‑values
  - Human and mouse models

### Paper info (for context)

- **Paper title**: Perturbation-response genes reveal signaling footprints in cancer gene expression
- **Journal**: Nature Communications, 2018

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/functional_signatures/pathway/resources/PROGENy/`
- **Format**: CSV (comma-separated), header row present.
- **Files**:
  - `PROGENy_human.csv`
  - `PROGENy_mouse.csv`

## Header Schema

All files share the same schema:

```text
Unnamed: 0,source,target,weight,padj
```

> Note: `Unnamed: 0` is an index column from export and can be ignored.

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/functional_signatures/pathway/resources/PROGENy/PROGENy_human.csv',
)

df = pd.read_csv(file_path)
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **source**: Pathway name (e.g., MAPK, PI3K, TGFb).
- **target**: Target gene symbol.
- **weight**: PROGENy weight for the pathway–gene association.
- **padj**: Adjusted P‑value for the association.

## Pathway Descriptions

- **Androgen**: involved in the growth and development of the male reproductive organs.
- **EGFR**: regulates growth, survival, migration, apoptosis, proliferation, and differentiation in mammalian cells.
- **Estrogen**: promotes the growth and development of the female reproductive organs.
- **Hypoxia**: promotes angiogenesis and metabolic reprogramming when O2 levels are low.
- **JAK-STAT**: involved in immunity, cell division, cell death, and tumor formation.
- **MAPK**: integrates external signals and promotes cell growth and proliferation.
- **NFkB**: regulates immune response, cytokine production and cell survival.
- **p53**: regulates cell cycle, apoptosis, DNA repair and tumor suppression.
- **PI3K**: promotes growth and proliferation.
- **TGFb**: involved in development, homeostasis, and repair of most tissues.
- **TNFa**: mediates haematopoiesis, immune surveillance, tumour regression and protection from infection.
- **Trail**: induces apoptosis.
- **VEGF**: mediates angiogenesis, vascular permeability, and cell migration.
- **WNT**: regulates organ morphogenesis during development and tissue repair.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `source` (pathway)
- **Step 2 (exact)**: `target`
- **Step 3 (exact)**: `padj`
- **Step 4 (contains)**: none (weights are numeric)

## Key Query Columns (关键词查询列)

1. **`source`**
2. **`target`**
3. **`weight`**
4. **`padj`**
