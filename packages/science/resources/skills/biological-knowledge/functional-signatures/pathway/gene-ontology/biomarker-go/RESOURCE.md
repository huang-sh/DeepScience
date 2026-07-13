---
name: biomarker-go
description: Query the bundled 2025 Gene Ontology Biological Process, Cellular Component, and Molecular Function gene sets by GO ID, term text, or gene symbol. Use for GO gene-set retrieval, term membership, reverse gene lookup, and reproducible local GO analysis.
category: biological-knowledge/functional-signatures/pathway/gene-ontology
license: Unknown
metadata:
  access-mode: local
  database: GO
  collection: biomarker
  release: "2025"
  local-data-files: 3
  documentation-files: 1
  script-files: 1
---

# GO 2025 Gene Sets

Use the bundled query script as the primary interface. It resolves its own data paths, returns
every matched gene, and keeps BP, CC, and MF records separate.

## File manifest

Paths below are relative to this Resource directory:

| Ontology | Data file | Records |
| --- | --- | ---: |
| Biological Process (`bp`) | `assets/GO/GO_Biological_Process_2025.txt` | 5,343 |
| Cellular Component (`cc`) | `assets/GO/GO_Cellular_Component_2025.txt` | 468 |
| Molecular Function (`mf`) | `assets/GO/GO_Molecular_Function_2025.txt` | 1,174 |

Read `references/GO_ref.md` only when schema, identifier, version, citation, or interpretation
details are needed.

## Query steps

1. **Select the branch.** Use `term` for a GO ID or a specific term, `search` for broad term
   discovery, and `gene` for reverse membership. Select `--ontology bp`, `cc`, `mf`, or `all`.
   This step is complete when the query mode and ontology scope match the user's request.

2. **Run an exact-first query.** Write machine-readable output into the Session workspace.

   ```bash
   python3 <resource-dir>/scripts/query_go.py term GO:0008203 --output go-cholesterol-metabolism.json
   python3 <resource-dir>/scripts/query_go.py term "Cholesterol Metabolic Process" --ontology bp --output go-cholesterol-metabolism.json
   python3 <resource-dir>/scripts/query_go.py search cholesterol --output go-cholesterol-search.json
   python3 <resource-dir>/scripts/query_go.py gene HMGCR --output go-hmgcr-membership.json
   ```

   `term` matches a GO ID, complete label, or term name case-insensitively. If it returns zero
   records for a concept query, use `search` once and select the scientifically relevant terms
   from the returned records. This step is complete when the output records show the requested
   term or clearly report a valid empty result.

3. **Preserve database boundaries.** Report every selected GO record with ontology, term, GO ID,
   gene count, complete gene-symbol list, source file, and release. When several terms match,
   return them as separate gene sets unless the user explicitly requests a union or intersection.
   This step is complete when every selected record and every member gene is represented without
   display limits or manual supplementation.

4. **Deliver reproducible artifacts.** Keep the script output and any derived table in the Session
   workspace. State the command, match mode, ontology scope, output path, and any identifier
   conversion in the final response. This step is complete when another run can reproduce the
   reported records from the saved command and bundled release.

## Output formats

JSON is the default. Add `--format tsv` for one row per term-gene membership:

```bash
python3 <resource-dir>/scripts/query_go.py search sterol --format tsv --output go-sterol.tsv
```

For manual source inspection with `read`, `grep`, or `glob`, address project files through
`project/packages/science/resources/skills/biological-knowledge/functional-signatures/pathway/gene-ontology/biomarker-go/`.
