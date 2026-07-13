---
name: biomarker-reactome
description: "Retrieve Reactome pathway gene-symbol sets from the bundled official release, or query live pathway records, physical participants, and enrichment services. Use gene-set for pathway genes and participants for molecular composition."
category: biological-knowledge/functional-signatures/pathway/reactome
license: Unknown
metadata:
  database: "Reactome"
  collection: biomarker
  access-mode: hybrid
  local-data-files: 1
---

# Reactome Database Resource

## Access Mode

- **Mode:** hybrid
- **Local gene sets:** extracted official Reactome v97 `ReactomePathways.gmt`; its manifest records
  the source ZIP URL and hashes
- **Remote services:** Reactome Content Service and Analysis Service
- **Connector:** `<resource-dir>/scripts/reactome_query.py`
- **Network requirement:** `search`, `query`, `participants`, `version`, and `enrich` require outbound
  HTTPS; `gene-set` uses the bundled snapshot offline.

## Hybrid coverage gate

Start locally for pathway-name discovery and pathway gene-symbol membership:

```bash
python3 <resource-dir>/scripts/reactome_query.py gene-set-find "cholesterol" \
  --species "Homo sapiens" --output reactome-gene-set-find.json
python3 <resource-dir>/scripts/reactome_query.py gene-set R-HSA-191273 \
  --species "Homo sapiens" --output reactome-cholesterol.genes.json
```

A non-empty exact stable-ID match in the bundled Reactome v97 GMT satisfies a pathway gene-symbol
request that does not require current data. Return it without a Content Service call.

Use the remote service when the request needs a current/live record, participant composition,
complexes, small molecules, enrichment, another unsupported field or namespace, or when local name
discovery/member lookup is empty. Query local and remote branches together only for an explicit
release comparison or independent validation, and keep their results separate.

## Reference routing

Load only the reference required by the selected operation:

- `references/gene-set-schema.md` — required for a pathway gene-symbol set.
- `references/participants-schema.md` — required before deriving pathway member sets, protein or
  molecule counts, or other molecular-composition views from `participants`.
- `references/Reactome_ref.md` — entity model, identifier families, and scientific interpretation.
- `references/api_reference.md` — raw Content Service and Analysis Service endpoint contracts.
- `references/reactome-database-guide.md` — broader enrichment, projection, analysis, and
  visualization workflows.

## Required Workflow

1. Select this Resource with the `resource` tool and read it before running its script.
2. Load the references selected by [Reference routing](#reference-routing).
3. Run a narrow query from the session workspace. Examples:

```bash
python3 <resource-dir>/scripts/reactome_query.py version
python3 <resource-dir>/scripts/reactome_query.py query R-HSA-109582
python3 <resource-dir>/scripts/reactome_query.py search apoptosis --species "Homo sapiens" --limit 10
python3 <resource-dir>/scripts/reactome_query.py gene-set-find cholesterol --species "Homo sapiens" --output reactome-gene-set-find.json
python3 <resource-dir>/scripts/reactome_query.py gene-set R-HSA-191273 --species "Homo sapiens" --output reactome-cholesterol.genes.json
python3 <resource-dir>/scripts/reactome_query.py participants R-HSA-191273 --output reactome-participants.raw.json
python3 <resource-dir>/scripts/reactome_query.py enrich TP53 BRCA1 EGFR MYC --limit 20 --output reactome-enrichment.json
```

4. For a pathway gene set, use `gene-set`; it reads the extracted GMT and writes gene-symbol JSON,
   a workspace copy of the selected official GMT source, and a provenance sidecar, then emits a
   validation manifest. For physical
   proteins, complexes, sets, small molecules, and therapeutics, use `participants` instead.
5. Use `--output` for results that become workspace artifacts. A `participants --output` invocation
   performs the participant retrieval once, obtains the stable-record and version verification
   responses, and writes three validated files: the requested raw JSON plus adjacent `.summary.json`
   and `.provenance.json` sidecars. Treat the emitted `validation: "passed"` manifest as the
   completion gate. Without `--output`, JSON is printed to stdout and no provenance bundle exists.
6. Use the generated summary as the first parsed view of a participants response. Build any
   task-specific derived table from the raw and summary artifacts in one consolidation pass.
7. Report the query, release or access date, stable IDs, identifier namespace, counts, and all artifact paths.
   Clearly report network, timeout, rate-limit, upstream API, or provenance-validation errors.

## Query Boundaries

- Keep searches and displayed results bounded with `--limit`; do not crawl or bulk-download Reactome.
- Search and enrichment pathway hits may be bounded, but `gene-set`, `query`, and `participants` return the
  complete upstream response. Reactome participants are heterogeneous PhysicalEntities and
  ReferenceEntities; use `gene-set` when the requested output is pathway gene symbols. Preserve
  participant native identifiers and interpret them with `references/participants-schema.md`.
- `enrich` sends only the identifiers supplied by the user/task to Reactome. Do not submit sensitive data.
- Treat an empty API result as “no result for this query/version,” not proof that a biological relationship does not exist.
- Do not silently fall back to a different pathway database.

## Reproducibility

For `gene-set`, the generated provenance sidecar records the Reactome release, official download
URL, bundled source SHA-256, stable ID, species, gene-set hash, and validation checks. For
`participants`, its generated provenance sidecar is the authoritative record of endpoint,
identifier, species, Reactome version, query parameters, access time, raw SHA-256, and complete
verification responses. Report filtering logic and task-specific row counts in derived artifacts.
Keep downloaded responses, derived tables, and plots in the session workspace rather than beside
this Resource.

## References

- **Database website:** https://reactome.org/
- **Citation:** https://doi.org/10.1093/nar/gkac1055
