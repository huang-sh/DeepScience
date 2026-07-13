# Transcription-factor References (Summary)

This `readme.md` consolidates the key points from:
- [`AnimalTFDB4_ref.md`](./AnimalTFDB4_ref.md)
- [`CollecTRI_ref.md`](./CollecTRI_ref.md)
- [`GTRD_ref.md`](./GTRD_ref.md)
- [`RegNetwork_ref.md`](./RegNetwork_ref.md)
- [`TF-marker_ref.md`](./TF-marker_ref.md)
- [`TRRUST_ref.md`](./TRRUST_ref.md)

## Golden rule (必须遵守)

- Read the reference docs first. **Design intent matters more than the database name.**
- Always state (in 1–2 lines) what a database is **designed for** before using it, plus any key interpretation limits (e.g., non-exhaustive coverage).

## Quick database selection (按问题选库)

| Question you want to answer | Use | Designed for |
|---|---|---|
| "Is gene X a TF / cofactor?" "List TFs" "TF family" | **AnimalTFDB4 + TF-Marker + CollecTRI + GTRD + RegNetwork + TRRUST** | Multi-source TF presence check (list + curated context + regulon/network + binding-derived target sets + literature-curated interactions) |
| "What genes does TF X regulate?" "Signed regulons" "TF targets" | **CollecTRI + RegNetwork + GTRD + TRRUST** | TF–target evidence (signed regulons + curated network edges + binding-derived target gene sets + literature-curated interactions with regulatory mode) |
| "Give me a TF target gene set from binding evidence (MSigDB C3:TFT:GTRD export)" | **GTRD** | TF target gene sets derived from GTRD uniform processing (promoter −1000 to +100bp around TSS) |
| "TF X regulates miRNA/lncRNA?" "TF regulatory network edges (human/mouse)" | **RegNetwork (core)** | Integrated TF→target network edges across entity types (no sign in local export) |
| "In which cell/tissue is TF X a marker?" "Marker evidence + PMID" | **TF-Marker (TFMarker / TF_Pmarker)** | Curated TF/marker + cell/tissue context + experiments |
| "TF–target interactions with literature evidence and regulatory mode?" | **TRRUST** | Literature-mined, manually curated TF–target interactions with PMID references and activation/repression annotation |

Note: many resources are not exhaustive TF lists; absence in a given database should not be interpreted as “not a TF”.

## Common workflow: gene set → “which genes are TFs?”

When the user asks something like “Hallmark EMT gene set: which genes are TFs?”:

1. Load the gene list from the gene set resource (e.g., MSigDB Hallmark module).
2. Treat this as a **TF presence check** (cross-resource) across this module's TF-containing resources:
   - `AnimalTFDB4`: exact `Symbol` match, but **separate TF vs cofactor** evidence
     - TF list: `*_TF.txt` → report as `AnimalTFDB4_TF`
     - Cofactor list: `*_Cof.txt` → report as `AnimalTFDB4_Cofactor` (**do not count as TF unless user explicitly requests "TF + cofactor"**)
   - `TF-Marker`: `Gene Name` match in **TF evidence categories only** (`TF.txt`, `TFMarker.txt`, `TF_Pmarker.txt`)
   - `CollecTRI`: `source` match (appears as a regulator in the regulon collection)
   - `GTRD export`: TF target set name for X exists (dataset naming convention)
   - `RegNetwork (core)`: `regulator_symbol` match (appears as a TF regulator in the core TF→target exports)
   - `TRRUST`: exact `TF` column match (appears as a TF in literature-curated interactions)
3. Report the result **per database** (and optionally the union/intersection), instead of only reporting a single "core TF list".

## AnimalTFDB4 (TF/cofactor listing & family)

- **Designed for**: genome-wide predicted TFs/cofactors across many animal species; provides TF family classification and identifiers.
- **Interpretation notes**: use this for TF/cofactor listing/classification; use CollecTRI/GTRD for TF targets and TF-Marker for cell/tissue marker context.
- **Important (TF vs cofactor)**:
  - AnimalTFDB4 provides **two different entity classes** in separate files: TFs (`*_TF.txt`) and transcription cofactors (`*_Cof.txt`).
  - For questions like “which genes are TFs?”, **report TF and cofactor evidence separately** (recommended columns: `AnimalTFDB4_TF`, `AnimalTFDB4_Cofactor`) and avoid merging them into a single “TF=yes” flag unless the user explicitly asks for “TF + cofactor”.
- **Paper**: *Nucleic Acids Research* 2023; PMID `36350632`; DOI `10.1093/nar/gkac1036`.
- **Local path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/AnimalTFDB4/`
- **Format**: TSV, header row, separated by species.
- **Schemas**:
  - `*_TF.txt`: `Species, Symbol, Ensembl, Family, Protein, Entrez_ID`
  - `*_Cof.txt`: `Species, Symbol, Ensembl, Family, Entrez_ID`
- **Best query keys (exact match)**: `Symbol`, `Ensembl`, `Entrez_ID` (then `Family`).

## CollecTRI (signed TF regulons / TF–target interactions)

- **Designed for**: TF–target interactions with sign/weight to construct signed regulons and support TF activity inference workflows.
- **Interpretation notes**: you can check whether `source == X` (X appears as a regulator in the regulon collection); absence does not mean “not a TF”.
- **Paper**: *Nucleic Acids Research* 2023; DOI `10.1093/nar/gkad841`.
- **Local file**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/CollecTRI_regulons.csv`
- **Format/schema**: CSV with `source, target, weight, resources, references, sign_decision`.
- **Best query keys (exact match)**: `source` (TF symbol) or `target` (gene symbol).

## RegNetwork (core TF→target network edges; human/mouse)

- **Designed for**: TF→target edges as an integrated GRN resource (human + mouse; targets include `Gene/TF/miRNA/lncRNA` depending on species).
- **Interpretation notes**: local core export has **no sign** column; use CollecTRI when you need signed regulons. Absence does not mean “no regulation”.
- **Paper**: *Nucleic Acids Research* 2026; DOI `10.1093/nar/gkaf779`.
- **Local path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/RegNetwork/`
- **Files/schema**: `human_core_TF_Target.txt`, `mouse_core_TF_Target.txt` (TSV, no header): `regulator_symbol, regulator_id, target_symbol, target_id, regulator_type, target_type`
- **Best query keys (exact match)**: `regulator_symbol`, `target_symbol`, `target_type` (then IDs if needed).

## GTRD (TF target gene sets; MSigDB C3:TFT:GTRD export)

- **Designed for**: uniformly processed TF target gene sets derived from GTRD TF binding site annotations (this local module is an MSigDB-style export).
- **Interpretation notes**: this local export is gene sets; absence does not mean “not a TF”.
- **Paper**: *Nucleic Acids Research* 2021; DOI `10.1093/nar/gkaa1057`.
- **Local path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/GTRD/`
- **Formats**:
  - GMT: `c3.tft.gtrd.v2025.1.Hs.symbols.gmt` (tab-separated; `tf_target_set`, `msigdb_url`, then gene symbols)
  - JSON: `c3.tft.gtrd.v2025.1.Hs.json` (TF set → metadata + `geneSymbols`)
- **Best query keys**: TF target set name; then exact gene symbol inclusion within that set.

## TF-Marker (TF/marker evidence in specific cell/tissue)

- **Designed for**: curated TFs and related markers with cell/tissue specificity annotations and literature-backed evidence (PMID).
- **Interpretation notes**: curated evidence in specific contexts; absence does not mean “not a TF”. TF-Marker includes **non-TF categories** (T_Marker/I_Marker) which must not be counted as TFs.
- **Paper**: *Nucleic Acids Research* 2022; DOI `10.1093/nar/gkab1114`.
- **Local path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/TF-marker/`
- **Files**: `TF.txt`, `T_Marker.txt`, `I_Marker.txt`, `TFMarker.txt`, `TF_Pmarker.txt`
- **Shared schema**: `PMID, Gene Name, Gene Type, Cell Name, Cell Type, Tissue Type, Experiment Type, Experimental Method, Title, Description of Gene, Interacting Gene, CellOntologyID`
- **Best query keys (exact match)**: `Gene Name`, `Gene Type`, `Cell Name/Cell Type`, `Tissue Type`.
  - For "is X a TF?" / "which genes are TFs?": use only `TF.txt`, `TFMarker.txt`, `TF_Pmarker.txt` (or `Gene Type ∈ {TF, TFMarker, TF Pmarker}`).

## TRRUST (literature-curated TF–target interactions)

- **Designed for**: literature-curated, manually verified TF–target interactions with regulatory mode (Activation/Repression/Unknown) and PMID references.
- **Interpretation notes**: curated through text mining + manual curation; absence does not mean "no interaction". Supports human (8,444 interactions, 800 TFs) and mouse (6,552 interactions, 828 TFs).
- **Paper**: *Nucleic Acids Research* 2018; DOI [10.1093/nar/gkx1013](https://doi.org/10.1093/nar/gkx1013).
- **Local path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/TRRUST/`
- **Files**:
  - `trrust_rawdata.human.tsv` (8,444 human TF–target interactions)
  - `trrust_rawdata.mouse.tsv` (6,552 mouse TF–target interactions)
- **Format/schema**: TSV with header: `TF, Target, Mode of Regulation, References(PMID)`
- **Best query keys (exact match)**: `TF` (regulator), `Target` (gene), then `Mode of Regulation` (Activation/Repression/Unknown) or `References(PMID)`.

## Common pitfalls (避免重蹈覆辙)

- For "is X a TF?":
  - Query all TF-containing resources in this module and report results **per database** (each uses a different schema/criterion):
    - **AnimalTFDB4**: exact `Symbol == X`, but keep **TF vs cofactor** as two separate predicates:
      - `*_TF.txt` → `AnimalTFDB4_TF`
      - `*_Cof.txt` → `AnimalTFDB4_Cofactor` (cofactor-only hit ≠ TF)
    - **TF-Marker**: exact `Gene Name == X` in TF evidence categories only (`TF.txt`, `TFMarker.txt`, `TF_Pmarker.txt`). Do **not** treat hits in `T_Marker.txt` / `I_Marker.txt` as TF evidence.
    - **CollecTRI**: exact `source == X` (X appears as a regulator in the regulon collection).
    - **GTRD (local export)**: TF target set name for X exists in the GMT/JSON export (set-name convention is dataset-defined).
    - **RegNetwork (core)**: exact `regulator_symbol == X` in the core TF→target exports (species-specific symbol conventions apply).
    - **TRRUST**: exact `TF == X` in the literature-curated TF–target interactions.
  - Do **not** treat **absence** from TF-Marker / CollecTRI / GTRD / RegNetwork / TRRUST as evidence that "X is not a TF" (these are not standardized/exhaustive TF list resources).
- Do **not** justify a database choice by its name; always justify by the reference docs in this folder.
- Prefer exact-match filtering for entities (gene symbols/IDs); avoid heuristic string matching for semantic categories.

## Visualization recommendations (可视化推荐)

If your final output includes TF–target interaction rows from **CollecTRI**, **RegNetwork**, or **TRRUST** (e.g., `TF` → `Target` with regulatory evidence), besides the basic `html-visual-generator` charts/tables, add an **interactive TF regulatory network graph** with the following layout spec.

- **Source node**: TF gene symbol (regulator)
- **Target node**: Target gene symbol
- **Directed edge**: `TF → Target` (one edge per interaction record)

### Edge design

- Directed arrows must point from TF to regulated target.
- Edge **color** encodes **regulatory mode** (when available):
  - **TRRUST/CollecTRI**:
    - `Activation`: green/positive (e.g., `#2ca02c`)
    - `Repression`: red/negative (e.g., `#d62728`)
    - `Unknown`/unsigned: gray/neutral (e.g., `#7f7f7f`)
  - **RegNetwork**: no regulatory mode (use gray)
- Edge **width/thickness** encodes **interaction strength** (when available):
  - **CollecTRI**: use `weight` column (signed/regulatory strength)
    - Map absolute weight `|weight|` to edge thickness (e.g., 1-5px range)
    - Suggested scaling: `width = base_width * |weight|` (base_width ~1px) or use quantile-based bins
    - Positive weight (activation) → green edge, thickness scaled by weight magnitude
    - Negative weight (repression) → red edge, thickness scaled by |weight|
  - **TRRUST/RegNetwork**: no weight field → use uniform thickness (e.g., 1.5px)
- **Edge style**: bezier curves + semi-transparent strokes (opacity ~0.6) for better visibility of overlapping edges.

### Node design

- **TF node color/shape**: distinct from target nodes to highlight regulators (e.g., circles for TFs, rectangles for targets)
- **Node size**: proportional to degree (TF out-degree / target in-degree) to highlight hub regulators and frequently regulated genes
- **Color by evidence source** (optional, for multi-database overlays):
  - CollecTRI: blue tint
  - TRRUST: purple tint
  - RegNetwork: orange tint

### Legend + filters

- Always include a legend for:
  - Edge colors (regulatory modes: Activation/Repression/Unknown)
  - Edge widths (interaction strength from CollecTRI weight)
  - Node types (TF vs Target)
- Add filters for:
  - **Regulatory mode** (Activation/Repression/Unknown) — especially important for TRRUST/CollecTRI
  - **Evidence source** (when combining multiple databases)
  - **Minimum |weight|** (if using `weight` from CollecTRI) — exclude weak interactions
  - **Edge weight range** (CollecTRI) — slider or quantile-based filter to focus on strong TF–target relationships
- For large networks (>100 nodes), consider:
  - Subnetwork extraction around a TF or gene of interest
  - Degree-based filtering (show top N hubs)
  - Weight-based filtering (show only top K strongest edges from CollecTRI)
  - Interactive search/hover to show PMID references (TRRUST), weight values (CollecTRI), or source resources (CollecTRI/RegNetwork)
