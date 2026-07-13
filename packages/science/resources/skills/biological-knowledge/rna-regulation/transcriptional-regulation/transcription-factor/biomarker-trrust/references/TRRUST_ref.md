# TRRUST v2 Transcriptional Regulatory Relationships Query Reference

- **Version**: TRRUST v2 (Nucleic Acids Research, 2018)
- **Paper year**: 2018

## Database Overview (for interpretation)

**TRRUST** (Transcriptional Regulatory Relationships Unraveled by Sentence-based Text mining) is a reference database of transcription factor (TF)–target interactions constructed through sentence-based text mining of PubMed literature, followed by manual curation. TRRUST v2 significantly expands coverage with data for both human and mouse.

- **Homepage**: `https://www.grnpedia.org/trrust/`
- **Scope**:
  - Human: 8,444 regulatory interactions for 800 TFs
  - Mouse: 6,552 TF–target interactions for 828 TFs
  - Curated TF–target gene interactions with regulatory mode (Activation/Repression/Unknown)
  - Literature-derived with PMID references

### Paper info (for context)

- **Paper title**: TRRUST v2: an expanded reference database of human and mouse transcriptional regulatory interactions
- **Journal**: Nucleic Acids Research, Volume 46, Issue D1, 4 January 2018, Pages D380–D386
- **DOI**: [10.1093/nar/gkx1013](https://doi.org/10.1093/nar/gkx1013)
- **Published**: 26 October 2017

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/TRRUST/`
- **Format**: TSV (tab-separated), header row present
- **Files**:
  - `trrust_rawdata.human.tsv` (8,444 human TF–target interactions)
  - `trrust_rawdata.mouse.tsv` (6,552 mouse TF–target interactions)

## Header Schema

```text
TF    Target    Mode of Regulation    References(PMID)
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/TRRUST/trrust_rawdata.human.tsv',
)

df = pd.read_csv(file_path, sep='\t')
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **TF**: Transcription factor gene symbol (regulator)
- **Target**: Target gene symbol regulated by the TF
- **Mode of Regulation**: Regulatory mode with three possible values:
  - `Activation`: TF activates the target gene
  - `Repression`: TF represses the target gene
  - `Unknown`: Regulatory mode not specified in literature
- **References(PMID)**: PubMed reference identifier(s) supporting the interaction

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `TF` or `Target` gene symbol
- **Step 2 (exact)**: `Mode of Regulation`
- **Step 3 (exact)**: `References(PMID)`

## Key Query Columns (关键词查询列)

1. **`TF`**
2. **`Target`**
3. **`Mode of Regulation`**
4. **`References(PMID)`**

## Interpretation notes / pitfalls

- TRRUST is a **curated reference database** but not exhaustive for all possible TF–target interactions
- Interactions are derived from literature mining and manual curation; absence does not imply no interaction exists
- The `Mode of Regulation` field may be `Unknown` for many interactions due to incomplete literature annotation
- PMID references allow traceability to source literature for validation
- For TF activity inference requiring signed regulons, consider complementing with **CollecTRI**
- Do **not** treat "not found in TRRUST" as evidence that a TF–target interaction does not exist
