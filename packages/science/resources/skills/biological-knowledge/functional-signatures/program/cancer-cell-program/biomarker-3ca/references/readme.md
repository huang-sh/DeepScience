# Cancer cell programs — References (Summary)

Module: `biomarker/functional_signatures/program/cancer_cell_program`

This folder documents cancer single-cell “program/signature” resources under `../resources/` (metaprograms and functional states).

## Reference files (detailed schemas)

- [`3ca_ref.md`](./3ca_ref.md)
- [`CancerSEA_ref.md`](./CancerSEA_ref.md)

## Local resources

- 3CA metaprograms: `../resources/3CA/`
  - `3ca.cancer_cell.mp.csv`
  - `3ca.normal_cell.mp.csv`
- CancerSEA functional states: `../resources/CancerSEA/*.txt` (one file per state, e.g., `EMT.txt`)

## 3CA (Curated Cancer Cell Atlas; metaprograms)

- **Designed for**: metaprogram → gene mappings derived from large-scale malignant and non-malignant single-cell analysis.
- **Data model**:
  - Cancer cell metaprograms: CSV with `celltype`, `metaprogram_id`, `metaprogram_description`, `url`, `gene`.
  - Normal cell metaprograms: CSV with `celltype`, `metaprogram_description`, `gene`.
- **Typical tasks**:
  - “Genes in metaprogram MPx” → filter `metaprogram_id`.
  - “Which metaprograms include gene G?” → filter `gene == G` and list matched metaprograms.
- **Interpretation limits**: metaprograms are co-expression gene sets (not necessarily causal pathways); always report which file (cancer vs normal) was used.

## CancerSEA (14 functional states; gene lists)

- **Designed for**: functional state gene signatures (e.g., EMT, proliferation, stemness) from a cancer single-cell atlas.
- **Data model**: TSV per state with `EnsembleID` (Ensembl gene ID) and `GeneName` (symbol).
- **Typical tasks**:
  - “Genes in state S” → read `../resources/CancerSEA/<State>.txt`.
  - “Which states contain gene G?” → reverse lookup across state files (report matched states).
- **Interpretation limits**: states are signature sets; they do not encode direction/sign or regulators.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
