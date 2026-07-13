# connectomeDB2025 Query Reference

- **Version**: CDB2025v1
- **Date released**: Sep 25 2025

## Database Overview (for interpretation)

**connectomeDB2025** is a rigorously curated, open-access database of peptide-based ligand–receptor interactions with primary experimental evidence, intended for accurate inference of cell–cell communication networks across multiple vertebrate species.

- **Homepage**: `https://connectomedb.org`
- **Scope**:
  - 14 vertebrate species (human, mouse, and 12 others)
  - 3579 ligand–receptor interactions
  - 2803 supporting research articles
  - 5429 evidence links (“triplets”)

### Paper info (for context)

- **Paper title**: connectomeDB2025: a rigorously curated, multi-species resource of experimentally supported ligand–receptor interactions.
- **Abstract**: Inferring cell–cell communication networks is now a cornerstone of single-cell RNA-seq and spatial transcriptomics data analysis, relying critically on reference catalogues of experimentally supported ligand–receptor interactions. Here, we present the updated, rigorously curated connectomeDB, an open-access database of peptide-based ligand–receptor pairs comprising 3579 vertebrate interactions supported by primary experimental evidence from 2803 research articles. By critically reviewing all putative ligand–receptor pairs from connectomeDB2020, CellChatDB v2, CellPhoneDB v5, CellTalkDB, ICELLNET v2, and LIANA+, we first removed over 2900 misclassified or unsupported interactions lacking primary literature evidence. We then expanded the resulting verified dataset through AI-assisted literature mining and manual curation, adding 827 pairs and 718 supporting articles absent from other databases, including 264 pairs first described since 2020. connectomeDB2025 contains 5429 evidence links (“triplets”), each connecting a ligand–receptor pair to a specific publication, collectively providing at least one source of primary experimental evidence for each interaction. Notably, 2359 of these triplets are exclusive to connectomeDB2025, making it the most robustly supported ligand–receptor database with primary experimental evidence. The online resource (https://connectomedb.org) provides searchable, downloadable ligand–receptor lists and detailed pair summaries, enabling accurate cell–cell communication analysis across human, mouse, and 12 other vertebrate species.
- **DOI**: 10.1093/nar/gkaf1108

## File

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/Cellular_landscape/cell–cell-communication/ligand-receptor-pair/data/ConnectomeDB/`
- **Format**: CSV (comma-separated), header row present.
- **Files**: Per-species files named `ConnectomeDB2025_<species>.csv`.


## Header Schema

### Standard schema (most species)

```text
Interaction ID,LR Pair,Ligand_gene,Receptor_gene,Evidence,AI summary,Ligand_aliases,Receptor_aliases,Ligand <DB> ID,Receptor <DB> ID,Ligand ENSEMBL ID,Receptor ENSEMBL ID,Human Ligand Symbols,Human Receptor Symbols,Ligand Location,Receptor Location
```

### Zebrafish schema (no human-ortholog columns)

```text
Interaction ID,LR Pair,Ligand_gene,Receptor_gene,Evidence,AI summary,Ligand_aliases,Receptor_aliases,Ligand ZFIN ID,Receptor ZFIN ID,Ligand ENSEMBL ID,Receptor ENSEMBL ID,Ligand Location,Receptor Location
```

## Query Header

```python
import os
import pandas as pd

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/Cellular_landscape/cell–cell-communication/ligand-receptor-pair/data/ConnectomeDB/ConnectomeDB2025_human.csv',
)

df = pd.read_csv(file_path)
print(df.columns.tolist())
print(df.head(1))
```

## Column Descriptions

- **Interaction ID**: Unique ConnectomeDB identifier for each ligand–receptor pair (e.g., `CDB15:0000548`).
- **LR Pair**: Human-readable ligand–receptor label (space-separated in these CSVs: `LIGAND RECEPTOR`).
- **Ligand_gene**: Ligand gene parsed from `LR Pair`.
- **Receptor_gene**: Receptor gene parsed from `LR Pair` (in rare cases may contain spaces; parsing uses the first whitespace split).
- **Evidence**: `Direct` (experimentally verified) or `Inferred` (inferred from orthology supporting the interaction).
- **AI summary**: AI-generated interaction summary.
- **Ligand_aliases**: Ligand symbol with known aliases/old names (as provided by ConnectomeDB export).
- **Receptor_aliases**: Receptor symbol with known aliases/old names (as provided by ConnectomeDB export).
- **Ligand <DB> ID / Receptor <DB> ID**: Species-specific IDs (see mapping below).
- **Ligand ENSEMBL ID / Receptor ENSEMBL ID**: Ensembl gene identifiers.
- **Human Ligand Symbols / Human Receptor Symbols**: Mapped human ortholog gene symbol(s) (not present in zebrafish CSV).
- **Ligand Location / Receptor Location**: Predicted subcellular localization of the human proteins.

## Species-Specific Mapping for Species-ID Columns

The `<DB> ID` column names depend on species:

| Species | Ligand ID Column Name | Receptor ID Column Name | ID Type / Database Used |
|---|---|---|---|
| Mouse | Ligand MGI ID | Receptor MGI ID | MGI: Mouse Genome Informatics |
| Rat | Ligand RGD ID | Receptor RGD ID | RGD: Rat Genome Database |
| Zebrafish | Ligand ZFIN ID | Receptor ZFIN ID | ZFIN: Zebrafish Information Network |
| Frog | Ligand XEN ID | Receptor XEN ID | XEN: Xenbase (frog model) |
| Human | Ligand HGNC ID | Receptor HGNC ID | HGNC: Human Gene Nomenclature |
| Other | Ligand XX ID | Receptor XX ID | Placeholder for future species/databases |

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `Interaction ID` or `Ligand_gene` or `Receptor_gene`
- **Step 2 (exact)**: `Human Ligand Symbols` / `Human Receptor Symbols` (when present)
- **Step 3 (exact)**: `LR Pair`
- **Step 4 (fuzzy / contains)**: `Ligand_aliases` / `Receptor_aliases`

## Key Query Columns (关键词查询列)

1. **`Ligand_gene`**
2. **`Receptor_gene`**
3. **`Human Ligand Symbols`**
4. **`Human Receptor Symbols`**
5. **`LR Pair`**
6. **`Interaction ID`**
