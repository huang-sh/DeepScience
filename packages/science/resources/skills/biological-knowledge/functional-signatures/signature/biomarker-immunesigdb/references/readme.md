# Gene signature collections — References (Summary)

Module: `biomarker/functional_signatures/signature`

This folder documents MSigDB-derived and related signature collections under `../resources/`.

## Reference files (detailed schemas)

- [`ImmuneSigDB_ref.md`](./ImmuneSigDB_ref.md)
- [`MSigDB.hallmark_ref.md`](./MSigDB.hallmark_ref.md)
- [`VAX_vaccine_response_ref.md`](./VAX_vaccine_response_ref.md)

## Local resources

- Hallmark (MSigDB H): `../resources/hallmark/`
  - `MSigDB.hallmark.all.v2025.1.Hs.symbols.gmt`
  - `MSigDB.hallmark.all.v2025.1.Hs.json`
- ImmuneSigDB (MSigDB C7): `../resources/ImmuneSigDB/`
  - `c7.immunesigdb.v2025.1.Hs.symbols.gmt`
  - `c7.immunesigdb.v2025.1.Hs.json`
- VAX vaccine response (MSigDB C7:VAX): `../resources/VAX_vaccine_response/`
  - `c7.vax.v2025.1.Hs.symbols.gmt`
  - `c7.vax.v2025.1.Hs.json`

## Common data model (GMT + JSON)

- **GMT**: one gene set per line: `set_name<TAB>msigdb_url<TAB>gene1<TAB>...`
- **JSON**: per-set metadata (collection/systematicName/PMID/URLs + `geneSymbols`)

Typical tasks:

- “Genes in gene set S” → lookup the GMT line for `S`.
- “Which gene sets contain gene G?” → scan containment (report matched set names + PMIDs if available).

Interpretation notes:

- Always report the version (e.g., `v2025.1.Hs`) and the collection (H vs C7 vs C7:VAX).
- These are gene sets for enrichment/signature analysis; they are not mechanistic pathway graphs.

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
