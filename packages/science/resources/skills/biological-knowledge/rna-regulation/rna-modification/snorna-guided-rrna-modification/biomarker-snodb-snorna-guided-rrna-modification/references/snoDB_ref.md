# snoDB 2.0 rRNA Modification Query Reference

- **Version**: snoDB 2.0
- **Paper year**: 2022

## Database Overview (for interpretation)

**snoDB 2.0** provides curated information on human snoRNAs and their guided rRNA chemical modifications. This folder contains the rRNA modification interaction tables and a position conversion table across common rRNA numbering systems.

- **Homepage**: `https://bioinfoscottgroup.med.usherbrooke.ca/snoDB/`
- **Scope**:
  - snoRNA–rRNA modification interactions
  - rRNA modification site annotations and evidence
  - rRNA position conversion across reference systems

### Paper info (for context)

- **Paper title**: snoDB 2.0: an enhanced interactive database, specializing in human snoRNAs
- **Journal**: Nucleic Acids Research, 2022

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/RNA_modification/snoRNA-guided_rRNA_modification/resources/`
- **Format**: TSV (tab-separated), header row present.
- **Files**:
  - `snoDB_rRNA_interactions_chemical_modifications.tsv`
  - `snoDB_rRNA_interactions_conversion_table.tsv`

## Header Schema

### snoDB_rRNA_interactions_chemical_modifications.tsv

```text
snoDB_id\tSymbol\tSite\tType\trRNA\tPos snoRNABase\tReferences\tStatus
```

### snoDB_rRNA_interactions_conversion_table.tsv

```text
rRNA\tPos snoRNABase\tPos Incarnato\tPos snOPY\tBase snoRNABase\tBase Incarnato\tBase snOPY
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/RNA_Regulation/RNA_modification/snoRNA-guided_rRNA_modification/resources/snoDB_rRNA_interactions_chemical_modifications.tsv',
)

df = pd.read_csv(file_path, sep='\t')
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

### snoDB_rRNA_interactions_chemical_modifications.tsv

- **snoDB_id**: snoDB identifier for the guiding snoRNA.
- **Symbol**: snoRNA symbol.
- **Site**: Modification site label (e.g., Am27).
- **Type**: Modification type (e.g., Nm).
- **rRNA**: rRNA molecule (e.g., 18S, 28S).
- **Pos snoRNABase**: Position in snoRNABase numbering.
- **References**: Source resources and literature.
- **Status**: Validation status (e.g., validated).

### snoDB_rRNA_interactions_conversion_table.tsv

- **rRNA**: rRNA molecule (e.g., 18S, 28S).
- **Pos snoRNABase**: Position in snoRNABase numbering.
- **Pos Incarnato**: Position in Incarnato reference system.
- **Pos snOPY**: Position in snOPY reference system.
- **Base snoRNABase**: Base at snoRNABase position.
- **Base Incarnato**: Base at Incarnato position.
- **Base snOPY**: Base at snOPY position.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `snoDB_id` or `Symbol`
- **Step 2 (exact)**: `rRNA` / `Site`
- **Step 3 (exact)**: `Type`
- **Step 4 (contains)**: `References` / `Status`

## Key Query Columns (关键词查询列)

1. **`snoDB_id`**
2. **`Symbol`**
3. **`rRNA`**
4. **`Site`**
5. **`Type`**
