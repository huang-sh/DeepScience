# KnockRBP Query Reference

- **Version**: KnockRBP (Nucleic Acids Research, 2025)
- **Paper year**: 2025

## Database Overview (for interpretation)

**KnockRBP** is a multi-omics database that catalogs regulatory changes caused by genetic perturbation of RNA-binding proteins (RBPs). It aggregates functional perturbation profiles across species, diseases, and cell lines, covering multiple post‑transcriptional layers (gene expression, alternative splicing, alternative polyadenylation, RNA editing, translation, and miRNA).

- **Homepage**: `https://knockrbp.xu-bioinfo.com`
- **Scope**:
  - Human and mouse datasets
  - Multiple post‑transcriptional modalities (APA, AS, editing, gene, translation, miRNA)
  - Disease-specific and normal-condition files

### Paper info (for context)

- **Paper title**: KnockRBP: an integrated multi-omics database of functional perturbation profiles for RNA-binding proteins
- **Journal**: Nucleic Acids Research (Database Issue), 2025
- **DOI**: 10.1093/nar/gkaf1059

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Post-transcriptional_Regulation/RBP_Regulation/resources/KnockRBP/`
- **Format**: CSV (comma-separated), header row present.
- **Structure**:
  - `human/<modality>/*.csv`
  - `mouse/<modality>/*.csv`
- **Modalities**:
  - `apa`, `as`, `editing`, `gene`, `translation`, `mirna`

## Header Schema

### APA (alternative polyadenylation)

Applies to: `human/apa/*.csv`, `mouse/apa/*.csv`

```text
Index,DataSetID,RBPSYMBOL,Genesymbol,DEAPA,ORF_APA,LOF_APA,CELLLINE,Disease,_disease,species,_species,_type
```

### AS (alternative splicing)

Applies to: `human/as/*.csv`, `mouse/as/*.csv`

```text
Index,DataSetID,RBPSYMBOL,Genesymbol,DEAS,ORF_AS,LOF_AS,CELLLINE,Disease,_disease,species,_species,_type
```

### RNA editing

Applies to: `human/editing/*.csv`, `mouse/editing/*.csv`

```text
Index,DataSetID,RBPSYMBOL,Genesymbol,DEEditing,ORF_Editing,LOF_Editing,CELLLINE,Disease,_disease,species,_species,_type
```

### Gene expression

Applies to: `human/gene/*.csv`, `mouse/gene/*.csv`

```text
Index,DataSetID,RBPSYMBOL,RBPID,Genesymbol,GeneID,log2FC,padj,baseMean,Change,CELLLINE,Disease,_disease,species,_species,_type
```

### Translation

Applies to: `human/translation/*.csv`, `mouse/translation/*.csv`

```text
Index,DataSetID,RBPSYMBOL,RBPID,Genesymbol,GeneID,log2FC,padj,baseMean,Change,CELLLINE,Disease,_disease,species,_species,_type
```

### miRNA

Applies to: `human/mirna/*.csv`, `mouse/mirna/*.csv`

```text
Index,DataSetID,RBPSYMBOL,Genesymbol,log2FC,padj,baseMean,Change,CELLLINE,Disease,_disease,species,_species,_type
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/RNA_Regulation/Post-transcriptional_Regulation/RBP_Regulation/resources/KnockRBP/human/gene/normal.csv',
)

df = pd.read_csv(file_path)
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

### Common metadata

- **Index**: Row index in the export.
- **DataSetID**: Dataset identifier in KnockRBP.
- **RBPSYMBOL**: RBP gene symbol (perturbed regulator).
- **Genesymbol**: Target gene symbol.
- **CELLLINE**: Cell line or sample context.
- **Disease**: Disease label for the dataset.
- **_disease**: Normalized disease label used by KnockRBP.
- **species**: Species name.
- **_species**: Normalized species label used by KnockRBP.
- **_type**: Record type label used by KnockRBP export.

### Differential gene/translation metrics

- **log2FC**: Log2 fold‑change.
- **padj**: Adjusted P‑value.
- **baseMean**: Mean normalized expression.
- **Change**: Direction/category of change.
- **GeneID**: Gene identifier (present in gene/translation).
- **RBPID**: RBP identifier (present in gene/translation).

### APA / AS / Editing event metrics

- **DEAPA / DEAS / DEEditing**: Differential event indicator for APA/AS/editing.
- **ORF_APA / ORF_AS / ORF_Editing**: Predicted ORF consequence for the event.
- **LOF_APA / LOF_AS / LOF_Editing**: Predicted loss‑of‑function impact.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `RBPSYMBOL` or `Genesymbol`
- **Step 2 (exact)**: `Disease` / `_disease` / `CELLLINE`
- **Step 3 (exact)**: `DataSetID`
- **Step 4 (contains)**: `Change` / `_type`

## Key Query Columns (关键词查询列)

1. **`RBPSYMBOL`**
2. **`Genesymbol`**
3. **`Disease`** / **`_disease`**
4. **`DataSetID`**
5. **`log2FC`** / **`padj`** (gene/translation/miRNA)
6. **`DEAPA`** / **`DEAS`** / **`DEEditing`** (event modalities)
