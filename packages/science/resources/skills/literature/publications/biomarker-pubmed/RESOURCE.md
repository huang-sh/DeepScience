---
name: biomarker-pubmed
description: "Search and retrieve PubMed records with MeSH-aware Boolean queries, NCBI E-utilities, pagination, batching, and reproducible citation metadata."
category: literature/publications
license: Mixed
metadata:
  access-mode: remote
  database: pubmed
---

# biomarker-pubmed

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Construct a focused PubMed query and retain it verbatim.
2. Obtain the exact package inventory with `catalog.py files biomarker-pubmed` before opening files.
3. Run the bounded package-local client from the Session workspace:

   ```bash
   python3 <resource-dir>/scripts/query_pubmed.py 'PCSK9 AND hypercholesterolemia' --limit 10 --sort date
   ```

   Read the relevant operating guide under `references/` when advanced fields, batching, or direct
   E-utilities access is required.
4. Treat this package as `remote`: a missing local snapshot does not make a documented
   remote source unavailable. Follow the selected guide's API, CLI, installation, authentication,
   rate-limit, and version requirements.
5. Save raw and normalized results in the Session workspace. Report the exact query, retrieval
   date, total hits, returned PMIDs, artifact path, and concrete failures. Distinguish title and
   abstract evidence from verified full-text evidence; never invent missing citations.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
