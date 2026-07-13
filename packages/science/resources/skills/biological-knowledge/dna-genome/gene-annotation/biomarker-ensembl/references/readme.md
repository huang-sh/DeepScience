# Gene annotation — References (Summary)

Module: `biomarker/DNA_and_Genome/Gene_annotation`

This module is **API-backed** (no local `../resources/` in this folder). Use the project skills for online gene annotation queries.

## Reference files

- [`ensembl_ref.md`](./ensembl_ref.md)

## Designed for

- Querying gene information by **symbol** or **Ensembl ID**
- Retrieving DNA / transcript / protein sequences
- Variant annotation (VEP)
- Ortholog/paralog lookup
- Regulatory/genomic feature annotations
- Assembly coordinate conversion (e.g., GRCh37 ↔ GRCh38)

## How to use (project standard)

- Prefer the `mygene-info` skill for quick gene lookups when available.
- Use the `ensembl-database` skill for Ensembl-specific queries (IDs, coordinates, sequences, VEP, orthology).

## Interpretation limits

- Results depend on the remote API version and reference genome build; always report the assembly/build when relevant.
- Always keep identifiers explicit (gene symbol vs Ensembl gene/transcript/protein IDs).

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
