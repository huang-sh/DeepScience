# AnimalTFDB 4.0 Query Reference

## Database Overview (for interpretation)

**AnimalTFDB 4.0** is a comprehensive animal transcription factor database. It contains predicted transcription factors (TFs) and transcription cofactors across 183 animal species. Version 4.0 includes updated data volume, variation annotations, post-translational modification sites, and expression annotations.

- **Homepage**: `http://bioinfo.life.hust.edu.cn/AnimalTFDB4/`
- **Scope**:
  - 183 animal species
  - 274,633 TF genes and 150,726 transcription cofactor genes
  - Includes annotations for variations, post-translational modifications (PTMs), autophagy regulation, and expression.

### Paper info (for context)

- **Paper title**: AnimalTFDB 4.0: a comprehensive animal transcription factor database updated with variation and expression annotations
- **Abstract**: Transcription factors (TFs) are proteins that interact with specific DNA sequences to regulate gene expression and play crucial roles in all kinds of biological processes. To keep up with new data and provide a more comprehensive resource for TF research, we updated the Animal Transcription Factor Database (AnimalTFDB) to version 4.0 (http://bioinfo.life.hust.edu.cn/AnimalTFDB4/) with up-to-date data and functions. We refined the TF family rules and prediction pipeline to predict TFs in genome-wide protein sequences from Ensembl. As a result, we predicted 274 633 TF genes and 150 726 transcription cofactor genes in AnimalTFDB 4.0 in 183 animal genomes, which are 86 more species than AnimalTFDB 3.0. Besides double data volume, we also added the following new annotations and functions to the database: (i) variations (including mutations) on TF genes in various human cancers and other diseases; (ii) predicted post-translational modification sites (including phosphorylation, acetylation, methylation and ubiquitination sites) on TFs in 8 species; (iii) TF regulation in autophagy; (iv) comprehensive TF expression annotation for 38 species; (v) exact and batch search functions allow users to search AnimalTFDB flexibly. AnimalTFDB 4.0 is a useful resource for studying TF and transcription regulation, which contains comprehensive annotation and classification of TFs and transcription cofactors.
- **Citation**: *Nucleic Acids Research*, Volume 51, Issue D1, 6 January 2023, Pages D33–D45.
- **PMID**: ** 36268869**
- **DOI**: **10.1093/nar/gkac907**

## File

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/AnimalTFDB4/`
- **Format**: TSV (tab-separated), header row present.
- **Files**: Organized by species and type (e.g., `Homo_sapiens_TF.txt`, `Homo_sapiens_Cof.txt`).

**Important (TF vs cofactor)**: AnimalTFDB4 provides predicted **TF** and predicted **transcription cofactor** lists in separate files. For “is X a TF?” style questions, report TF (`*_TF.txt`) and cofactor (`*_Cof.txt`) evidence separately unless the user explicitly requests “TF + cofactor”.

## Header Schema

### For TF files (`*_TF.txt`)
```text
Species	Symbol	Ensembl	Family	Protein	Entrez_ID
```

### For Cofactor files (`*_Cof.txt`)
```text
Species	Symbol	Ensembl	Family	Entrez_ID
```

## Query Header

```python
import pandas as pd
import os

# Example for Homo sapiens TF
file_path = os.path.join('$CLAUDE_PROJECT_DIR', 'agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/AnimalTFDB4/Homo_sapiens_TF.txt')
df = pd.read_csv(file_path, sep='\t')

print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **Species**: Species name (e.g., Homo_sapiens).
- **Symbol**: Official gene symbol.
- **Ensembl**: Ensembl gene identifier (ENSG...).
- **Family**: Transcription factor or cofactor family classification.
- **Protein**: (TF only) Ensembl protein identifier(s).
- **Entrez_ID**: Entrez gene identifier.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `Symbol` or `Ensembl` or `Entrez_ID`
- **Step 2 (exact)**: `Family`
- **Step 3 (exact)**: `Species` (though files are already separated by species)

## Key Query Columns (关键词查询列)

1. **`Symbol`**
2. **`Ensembl`**
3. **`Family`**
4. **`Entrez_ID`**
