# miRTarBase 2025 Query Reference

- **Version**: miRTarBase 2025
- **Paper year**: 2024 (advance access)

## Database Overview (for interpretation)

**miRTarBase** is a curated database of experimentally validated microRNA–target interactions (MTIs). The 2025 release expands validated MTIs and introduces additional annotations such as therapeutic associations and oxidized miRNA sequences.

- **Homepage**: `https://mirtarbase.cuhk.edu.cn/~miRTarBase/miRTarBase_2025`
- **Scope**:
  - Experimentally validated miRNA–target interactions (MTIs)
  - Evidence types and support classifications
  - Species information for miRNA and target genes

### Paper info (for context)

- **Paper title**: miRTarBase 2025: updates to the collection of experimentally validated microRNA–target interactions
- **Journal**: Nucleic Acids Research (Database Issue), 2025
- **DOI**: 10.1093/nar/gkae1072

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Post-transcriptional_Regulation/microRNA–target interactions/resources/`
- **Format**: CSV (comma-separated), header row present.
- **Files**:
  - `miRTarBase_SE_R.csv`
  - `miRTarBase_SE_W.csv`
  - `miRTarBase_SE_WR.csv`

### Current dataset coverage

- Release 10.0
- **miRTarBase_SE_WR.csv**: Supported by strong experimental evidences (Reporter assay or Western blot).
- **miRTarBase_SE_W.csv**: Supported by strong experimental evidences (Western blot).
- **miRTarBase_SE_R.csv**: Supported by strong experimental evidences (Reporter assay).

## Header Schema

All files share the same schema:

```text
miRTarBase ID,miRNA,Species (miRNA),Target Gene,Target Gene (Entrez ID),Species (Target Gene),Experiments,Support Type,References (PMID)
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/RNA_Regulation/Post-transcriptional_Regulation/microRNA–target interactions/resources/miRTarBase_SE_R.csv',
)

df = pd.read_csv(file_path)
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **miRTarBase ID**: Unique miRTarBase interaction identifier.
- **miRNA**: miRNA name/symbol.
- **Species (miRNA)**: Species of the miRNA.
- **Target Gene**: Target gene symbol.
- **Target Gene (Entrez ID)**: Entrez Gene ID for the target.
- **Species (Target Gene)**: Species of the target gene.
- **Experiments**: Experimental methods supporting the interaction.
- **Support Type**: Support classification (strong/weak or combined categories).
- **References (PMID)**: PubMed IDs supporting the interaction.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `miRNA` or `Target Gene`
- **Step 2 (exact)**: `miRTarBase ID` / `Target Gene (Entrez ID)`
- **Step 3 (exact)**: `Support Type`
- **Step 4 (contains)**: `Experiments` / `References (PMID)`

## Key Query Columns (关键词查询列)

1. **`miRNA`**
2. **`Target Gene`**
3. **`miRTarBase ID`**
4. **`Support Type`**
5. **`References (PMID)`**
