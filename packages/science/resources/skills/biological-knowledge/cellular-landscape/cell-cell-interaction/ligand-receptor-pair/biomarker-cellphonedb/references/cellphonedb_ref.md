# CellPhoneDB Query Reference

## File

- Path: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/Cellular_landscape/cell–cell-interaction/ligand-receptor-pair/resources/cellphonedb-human.csv`
- Format: CSV (comma-separated), header row present

## Paper info (for context)

- **Title**: CellPhoneDB v5: inferring cell–cell communication from single-cell multiomics data
- **Journal**: Nature Protocols, 2025
- **DOI**: 10.1038/s41596-025-01088-1

## What this database contains

- Human **ligand–receptor interaction** definitions from CellPhoneDB.
- This is not a cell-type marker database; it does not encode “T cell markers”.

## Header schema (from the actual file)

Columns in `cellphonedb-human.csv` (note: there is an **empty column name** in the raw header):

```
id_cp_interaction,partner_a_Ligand,partner_b_Receptor,,protein_name_a_Ligand,protein_name_b_Receptor,annotation_strategy,source,is_ppi,curator,reactome_complex,reactome_reaction,reactome_pathway,complexPortal_complex,comments,version,interaction_name-,classification,directionality,modulatory_effect
```

Practical note for pandas:

- The empty column name will typically be read as `Unnamed: 3` (depending on parser settings).
- The column `interaction_name-` includes a trailing hyphen and must be referenced **exactly** as-is.

## Column meanings + recommended query strategy (按语序/渐进式)

Guiding principle:

- For **qualitative identifiers** (gene/protein identifiers, classification labels): use **exact matching only**.
- For **descriptive** columns: **do not restrict** unless the user explicitly asks.

Recommended query order:

1. Primary interaction identifiers (exact):
   - `interaction_name-` (stable readable identifier)
2. Ligand / receptor identifiers (exact):
   - `partner_a_Ligand`, `partner_b_Receptor`
   - If these are complexes (e.g., `integrin_a2b1_complex`), keep exact matching on the complex name (do not substring-match).
3. Small enumerations (exact; enumerate uniques if needed):
   - `classification`, `directionality`, `modulatory_effect`, `annotation_strategy`, `source`, `is_ppi`, `version`
4. Keep descriptive columns unfiltered:
   - `comments`, `reactome_*`, `complexPortal_complex`, `protein_name_*`, `curator`

## Matching rules

- Use `==` / `isin([...])` on the chosen identifier columns.
- Do not use substring matching / regex heuristics for category selection.
- For label-like columns, select labels only from explicit unique values and filter via `isin(...)`.
- Do not filter using descriptive columns by default.

## Progressive filtering guidance

- If a user-provided label/value is not found by exact match:
  - Enumerate unique values when small (`nunique <= 100`) and ask for exact selection.
  - Otherwise export uniques and request exact selection (no guessing via string rules).

## Output

- One database file → one output file under `$CLAUDE_PROJECT_DIR/output/<sessionId>/`
- Preserve original headers and CSV delimiter.

