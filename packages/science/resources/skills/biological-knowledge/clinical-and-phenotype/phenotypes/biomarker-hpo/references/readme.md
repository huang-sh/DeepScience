# Phenotype (HPO gene sets) — References (Summary)

Module: `biomarker/clinical-and-phenotype/phenotype`

This folder documents the HPO gene set exports used in this project (MSigDB C5:HPO).

## Reference files (detailed schemas)

- [`HPO_ref.md`](./HPO_ref.md)

## Local resources

- `../resources/c5.hpo.v2025.1.Hs.symbols.gmt`
- `../resources/c5.hpo.v2025.1.Hs.json`

## Human Phenotype Ontology (HPO) via MSigDB

- **Designed for**: mapping phenotypes (HPO terms) to associated gene sets; supports phenotype→genes and gene→phenotype-set queries.
- **Data model**:
  - GMT: one phenotype gene set per line (`gene_set_name`, `msigdb_url`, then gene symbols).
  - JSON: maps `gene_set_name` to metadata including the HPO ID (`HP:...`).
- **Typical tasks**:
  - “Genes for phenotype HP:xxxx” → map HPO ID via JSON, then read that GMT line.
  - “Which HPO terms contain gene G?” → scan GMT lines (report matching set names + HPO IDs).
- **Interpretation limits**: this is an MSigDB export; report the MSigDB version (`v2025.1.Hs`) and distinguish `phenotype_name` (snake_case label) from the stable `hpo_id`.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
