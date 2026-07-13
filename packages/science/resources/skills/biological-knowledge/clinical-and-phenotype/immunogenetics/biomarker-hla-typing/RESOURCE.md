---
name: biomarker-hla-typing
description: "Type and reconcile HLA alleles from sequencing or imputation workflows and interpret transplant, pharmacogenomic, neoantigen, and disease-association use cases."
category: biological-knowledge/clinical-and-phenotype/immunogenetics
license: Mixed
metadata:
  access-mode: hybrid
  database: hla-typing
---

# biomarker-hla-typing

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-hla-typing` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

This package has no bundled HLA reference database. The local route satisfies typing only when the
sequencing or imputation input, compatible caller, HLA reference files, genome build, and allele
database release are available locally. Use a documented remote service or reference download only
when those local prerequisites cannot cover the assay or requested release. Preserve caller and
reference-version provenance across either route.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
