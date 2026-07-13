# CellChatDB Query Reference

- **Version**: CellChatDB v1
- **Paper year**: 2021

## Database Overview (for interpretation)

**CellChatDB** is a curated database of ligand–receptor interactions (including cofactors) used by CellChat to infer cell–cell communication networks. The local resources include human, mouse, and zebrafish interaction tables.

- **Homepage**: `http://www.cellchat.org/`
- **Scope**:
  - Ligand–receptor interactions with cofactors
  - Pathway annotations and evidence
  - Human, mouse, and zebrafish tables

### Paper info (for context)

- **Paper title**: Inference and analysis of cell-cell communication using CellChat
- **Journal**: Nature Communications, 2021
- **DOI**: 10.1038/s41467-021-21246-9

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/Cellular_landscape/cell–cell-interaction/ligand-receptor-pair/resources/CellChatDB/`
- **Format**: TSV (tab-separated), header row present.
- **Files**:
  - `CellChatDB.human.tsv`
  - `CellChatDB.mouse.tsv`
  - `CellChatDB.zebrafish.tsv`

## Header Schema

### Human / Mouse

```text
Unnamed: 0	interaction_name	pathway_name	ligand	receptor	agonist	antagonist	co_A_receptor	co_I_receptor	annotation	interaction_name_2	evidence	is_neurotransmitter	ligand.symbol	ligand.family	ligand.location	ligand.keyword	ligand.secreted_type	ligand.transmembrane	receptor.symbol	receptor.family	receptor.location	receptor.keyword	receptor.surfaceome_main	receptor.surfaceome_sub	receptor.adhesome	receptor.secreted_type	receptor.transmembrane	version
```

### Zebrafish

```text
Unnamed: 0	interaction_name	pathway_name	ligand	receptor	agonist	antagonist	co_A_receptor	co_I_receptor	evidence	annotation	interaction_name_2
```

> Note: `Unnamed: 0` is an index column from export and can be ignored.

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/Cellular_landscape/cell–cell-interaction/ligand-receptor-pair/resources/CellChatDB/CellChatDB.human.tsv',
)

df = pd.read_csv(file_path, sep='\t')
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **interaction_name**: Interaction identifier (ligand_receptor format).
- **pathway_name**: Signaling pathway name.
- **ligand / receptor**: Ligand and receptor gene symbols.
- **agonist / antagonist**: Agonist/antagonist labels if present.
- **co_A_receptor / co_I_receptor**: Co‑activation/inhibition receptors.
- **annotation**: Interaction category (e.g., Secreted Signaling).
- **interaction_name_2**: Human‑readable interaction label.
- **evidence**: Evidence source (e.g., KEGG). 
- **is_neurotransmitter**: Boolean for neurotransmitter interaction (human/mouse only).
- **ligand.* / receptor.* fields**: Additional annotations for ligand/receptor families, location, keywords, surfaceome, etc.
- **version**: CellChatDB version label.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `ligand` / `receptor`
- **Step 2 (exact)**: `pathway_name`
- **Step 3 (exact)**: `interaction_name`
- **Step 4 (contains)**: `annotation` / `evidence`

## Key Query Columns (关键词查询列)

1. **`ligand`**
2. **`receptor`**
3. **`pathway_name`**
4. **`interaction_name`**
5. **`evidence`**
