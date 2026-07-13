# Pathway resources — References (Summary)

Module: `biomarker/functional_signatures/pathway`

This folder documents pathway gene sets and pathway-related resources under `../resources/`.

## Reference files (detailed schemas)

- [`GO_ref.md`](./GO_ref.md)
- [`KEGG_ref.md`](./KEGG_ref.md)
- [`PROGENy_ref.md`](./PROGENy_ref.md)
- [`WikiPathways_ref.md`](./WikiPathways_ref.md)

## Local resources (high level)

- GO gene sets: `../resources/GO/GO_*_2025.txt`
- KEGG gene sets: `../resources/KEGG/KEGG_2026.txt`
- PROGENy weights: `../resources/PROGENy/PROGENy_{human,mouse}.csv`
- WikiPathways GMTs: `../resources/WikiPathways/wikipathways-20260110-gmt-*.gmt`

## Quick selection (按任务选库)

| Task | Use | Data type |
|---|---|---|
| “Gene set enrichment for a pathway/term” | GO / KEGG / WikiPathways | gene sets (term/pathway → genes) |
| “Pathway activity scoring using weighted footprints” | PROGENy | pathway→gene weights (`weight`, `padj`) |

## GO (Gene Ontology) gene sets

- **Designed for**: GO term → gene sets (BP/CC/MF; term → genes).
- **Local files**: `../resources/GO/GO_Biological_Process_2025.txt`, `GO_Cellular_Component_2025.txt`, `GO_Molecular_Function_2025.txt`
- **Format/schema**: one term per line: `GO_term_with_ID<TAB>gene1<TAB>...`
- **Typical queries**:
  - Lookup by GO ID or term name (in the first field).
  - Reverse lookup: which GO terms contain a gene.

## KEGG pathway gene sets

- **Designed for**: pathway title → gene sets (pathway → genes).
- **Local file**: `../resources/KEGG/KEGG_2026.txt`
- **Format/schema**: one pathway per line: `pathway_name<TAB>gene1<TAB>...`
- **Typical queries**: lookup pathway names; reverse lookup by gene (which pathways contain it).

## WikiPathways GMT exports (multi-species)

- **Designed for**: community-curated pathway gene sets in GMT format, per species.
- **Local files**: `../resources/WikiPathways/wikipathways-20260110-gmt-<Species>.gmt`
- **Format/schema**: `pathway_meta<TAB>pathway_url<TAB>gene1<TAB>...`
  - `pathway_meta` encodes: `PathwayName%WikiPathways_YYYYMMDD%WPID%Species`
- **Interpretation limits**: gene identifiers are species-specific; always pick the correct species GMT.

## PROGENy (pathway footprint weights)

- **Designed for**: pathway activity inference using perturbation-response gene weights.
- **Local files**: `../resources/PROGENy/PROGENy_human.csv`, `PROGENy_mouse.csv`
- **Key fields**: `source` (pathway), `target` (gene), `weight`, `padj` (`Unnamed: 0` is an index column).
- **Interpretation limits**: these are weights for scoring, not canonical pathway gene sets.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
