# Ligand–receptor pairs — References (Summary)

Module: `biomarker/Cellular_landscape/cell–cell-interaction/ligand-receptor-pair`

This folder documents ligand–receptor (LR) interaction catalogues used as priors for cell–cell communication analysis. The local resources live under `../resources/`.

## Reference files (detailed schemas)

- [`CellChatDB_ref.md`](./CellChatDB_ref.md)
- [`ConnectomeDB_ref.md`](./ConnectomeDB_ref.md)
- [`cellphonedb_ref.md`](./cellphonedb_ref.md)

## Local resources

- `../resources/CellChatDB/CellChatDB.human.tsv` (also mouse, zebrafish)
- `../resources/ConnectomeDB/ConnectomeDB2025_human.csv` (also other species)
- `../resources/cellphonedb-human.csv`

## Quick selection (按任务选库)

| Task | Use | Key fields |
|---|---|---|
| “Given ligand+receptor genes, is this LR pair present?” | CellChatDB / ConnectomeDB / CellPhoneDB | `ligand/receptor`, `Ligand_gene/Receptor_gene`, `partner_a_Ligand/partner_b_Receptor` |
| “Need pathway annotations / cofactors (agonist/antagonist/co-receptors)” | CellChatDB | `pathway_name`, `co_A_receptor`, `co_I_receptor`, `annotation`, `evidence` |
| “Need primary experimental evidence curation across many vertebrates” | ConnectomeDB2025 | `Evidence` (Direct/Inferred), `Interaction ID`, `AI summary` |
| “Need CellPhoneDB interaction definitions & metadata fields” | CellPhoneDB | `interaction_name-`, `classification`, `directionality`, `modulatory_effect` |

Interpretation note: these are **interaction definitions**, not expression evidence. To infer “cell A communicates with cell B”, you must combine LR catalogs with expression/abundance in your dataset.

## CellChatDB (v1; human/mouse/zebrafish)

- **Designed for**: curated LR interactions (incl. cofactors) used by CellChat to infer communication networks.
- **Local files**: `../resources/CellChatDB/CellChatDB.<species>.tsv`
- **Format/schema**:
  - Core columns: `interaction_name`, `pathway_name`, `ligand`, `receptor`, `annotation`, `evidence`
  - Extra annotation fields in human/mouse: `ligand.*`, `receptor.*`, `is_neurotransmitter`, etc.
  - `Unnamed: 0` is an export index column (ignore).
- **Typical queries**:
  - Find interactions for a ligand/receptor: exact match on `ligand` or `receptor`.
  - Filter by pathway: exact `pathway_name`.

## connectomeDB2025 (multi-species)

- **Designed for**: rigorously curated peptide-based LR interactions with primary experimental evidence; multi-vertebrate support.
- **Local files**: `../resources/ConnectomeDB/ConnectomeDB2025_<species>.csv`
- **Key fields**: `Interaction ID`, `LR Pair`, `Ligand_gene`, `Receptor_gene`, `Evidence` (Direct/Inferred), `AI summary`, `Ligand_aliases`, `Receptor_aliases`, `Ligand ENSEMBL ID`, `Receptor ENSEMBL ID`.
- **Practical notes**:
  - `LR Pair` is a human-readable label (space-separated in this export).
  - Some species include “Human * Symbols” ortholog columns; zebrafish schema differs slightly.
- **Typical queries**:
  - Exact match on `Ligand_gene` / `Receptor_gene` (or `Interaction ID`).
  - Optional alias-based search on `Ligand_aliases` / `Receptor_aliases` (only when exact match fails, and keep results explicitly “alias-based”).

## CellPhoneDB (human; v5 export)

- **Designed for**: CellPhoneDB LR interaction definitions (includes complexes and metadata).
- **Local file**: `../resources/cellphonedb-human.csv`
- **Practical header quirks**:
  - One column in the raw CSV header is empty (often read by pandas as `Unnamed: 3`).
  - Column `interaction_name-` contains a trailing hyphen and must be referenced exactly.
- **Typical queries**:
  - Exact match on `interaction_name-`, `partner_a_Ligand`, `partner_b_Receptor`.
  - Enumerate small label columns before filtering: `classification`, `directionality`, `modulatory_effect`, etc.
- **Interpretation limits**: complex names are identifiers; do not substring-match complex members.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
