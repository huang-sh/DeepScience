# snoRNA-guided rRNA modifications — References (Summary)

Module: `biomarker/RNA_Regulation/RNA_modification/snoRNA-guided_rRNA_modification`

This folder documents snoDB rRNA modification interaction tables under `../resources/`.

## Reference files (detailed schemas)

- [`snoDB_ref.md`](./snoDB_ref.md)

## Local resources

- `../resources/snoDB_rRNA_interactions_chemical_modifications.tsv`
- `../resources/snoDB_rRNA_interactions_conversion_table.tsv`

## snoDB 2.0 (rRNA chemical modifications)

- **Designed for**: curated snoRNA→rRNA modification interactions and coordinate conversions across rRNA numbering systems.
- **Core interaction fields** (chemical modifications table):
  - snoRNA identifiers: `snoDB_id`, `Symbol`
  - modification: `Site`, `Type`, `rRNA`
  - metadata: `References`, `Status`
- **Typical tasks**:
  - “Which snoRNAs guide modifications on rRNA 18S/28S?” → filter `rRNA`.
  - “What is modified at site X?” → filter `Site`.
  - “Convert positions across snoRNABase/Incarnato/snOPY” → use the conversion table.
- **Interpretation limits**: position systems differ; always state which position column you are using (`Pos snoRNABase` etc.).

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
