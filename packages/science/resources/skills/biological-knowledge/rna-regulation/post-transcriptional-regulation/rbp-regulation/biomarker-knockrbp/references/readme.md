# RBP perturbation (post-transcriptional regulation) — References (Summary)

Module: `biomarker/RNA_Regulation/Post-transcriptional_Regulation/RBP_Regulation`

This folder documents the KnockRBP local exports under `../resources/KnockRBP/`.

## Reference files (detailed schemas)

- [`KnockRBP_ref.md`](./KnockRBP_ref.md)

## Local resources

- `../resources/KnockRBP/human/<modality>/*.csv`
- `../resources/KnockRBP/mouse/<modality>/*.csv`

Modalities include: `gene`, `translation`, `apa`, `as`, `editing`, `mirna`.

## KnockRBP (2025)

- **Designed for**: multi-omics perturbation profiles of RNA-binding proteins (RBPs) — i.e., how knocking down/out an RBP changes targets across modalities.
- **Core entities**:
  - Regulator: `RBPSYMBOL` (the perturbed RBP)
  - Target: `Genesymbol`
  - Context: `CELLLINE`, `Disease`, `species`
- **Typical tasks**:
  - “Which genes change when RBP X is perturbed?” → filter `RBPSYMBOL == X` in `gene` and/or `translation`.
  - “Does RBP X affect APA/AS/editing for gene Y?” → filter `RBPSYMBOL == X` + `Genesymbol == Y` in event modalities.
  - “Compare disease vs normal exports” → filter `Disease/_disease` and report file + modality explicitly.
- **Interpretation limits**:
  - This is not a static binding/interactions catalog; it is **perturbation outcome** data.
  - Different modalities have different columns (e.g., `log2FC/padj` vs `DEAPA/DEAS/DEEditing`); always report the modality and file path used.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
