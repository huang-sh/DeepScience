# Metabolic landscape — References (Summary)

Module: `biomarker/metabolic_landscape`

This folder documents metabolite-related resources (local curated tables + online APIs).

## Reference files

- [`HMDB_ref.md`](./HMDB_ref.md)
- [`MACdb_ref.md`](./MACdb_ref.md)
- [`metabolomics_workbench_ref.md`](./metabolomics_workbench_ref.md)

## Local resources

- `../resources/MACdb.metabolite.txt` (TSV)

## MACdb (cancer–metabolite associations)

- **Designed for**: curated cancer–metabolite association records with case/control concentration summaries.
- **Local file**: `../resources/MACdb.metabolite.txt`
- **Key fields**: `original_metabolite_name`, `pubchem_CID`, `case_concentration`, `control_concentration`, `case_control_p-value`, `log2FC`, `Cohort_id`.
- **Interpretation limits**:
  - The export contains duplicate column names (`Delta_concentration` appears twice); be explicit about how your parser handles this.
  - Concentration fields are study-specific; always report the cohort/context (`Cohort_id`).

## HMDB (Human Metabolome Database)

- **Designed for**: comprehensive human metabolite data with chemical properties, clinical biomarkers, pathways, and NMR/MS spectra.
- **How to use**: use the `hmdb-database` skill (web-based access; data downloads available).
- **Key features**: 220,945 metabolites, 130+ data fields per entry, spectral data for metabolite identification.

## Metabolomics Workbench (online API)

- **Designed for**: querying metabolomics datasets, metabolites, and study metadata from Metabolomics Workbench.
- **How to use**: use the `metabolomics-workbench-database` skill (this module is API-backed; local files are not provided here).

## Project rules

Follow `$CLAUDE_PROJECT_DIR/agentspace/CLAUDE.md` (reference-first + exact matching + reviewer).
