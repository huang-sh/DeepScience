# Protein landscape (API-backed) — References (Summary)

Module: `biomarker/protein_landscape`

This module is primarily **API-backed** (no local `../resources/` under this folder). Use the project skills for online protein annotation/structure/interaction queries.

## Reference files

- [`uniprot_ref.md`](./uniprot_ref.md)
- [`AlphaFold_ref.md`](./AlphaFold_ref.md)
- [`PDB_ref.md`](./PDB_ref.md)
- [`string_ref.md`](./string_ref.md)

## Quick selection (按任务选库/技能)

| Task | Use skill | Notes |
|---|---|---|
| Protein annotation (function, domains, isoforms, IDs) | `uniprot-database` | Start from UniProt ID or gene/protein name |
| Protein structure prediction | `alphafold-database` | Use UniProt ID; report confidence (pLDDT/PAE) |
| Experimental structures | `pdb-database` | Fetch PDB/mmCIF by PDB ID or mapped IDs |
| Protein–protein interactions | `string-database` | Report organism/species and score thresholds |

## Interpretation limits

- API results can change with upstream releases; always report identifiers used (UniProt/PDB IDs) and (if available) API/version metadata.
- Structures/PPIs are evidence-dependent; avoid over-interpreting predictions without confidence/evidence fields.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
