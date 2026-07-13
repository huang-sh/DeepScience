---
name: biomarker-acmg-classification
description: "Interpret germline and somatic variants using ACMG/AMP, ClinGen SVI, Bayesian evidence, PVS1, computational, functional, and tumor-tier frameworks."
category: biological-knowledge/clinical-and-phenotype/variants
license: Mixed
metadata:
  access-mode: hybrid
  database: acmg-classification
---

# biomarker-acmg-classification

Use this package after the scientific resource router selects it for the requested entity, evidence,
organism, identifier namespace, and freshness requirement.

## Procedure

1. Read only the relevant operating guide under `references/`.
2. Obtain the exact package inventory with `catalog.py files biomarker-acmg-classification` before opening files.
3. Prefer a bundled script under `scripts/` when it implements the requested operation.
4. Apply the hybrid coverage gate below before any network action.
5. Save raw and normalized results in the Session workspace. Report source, query or record,
   organism, namespace, release or retrieval date, count, artifact path, and concrete failures.

## Hybrid coverage gate

This package has no bundled ClinVar, ClinGen, population-frequency, or disease-evidence snapshot.
The local route satisfies classification only when a dated evidence bundle contains every item
needed for the applicable ACMG/AMP criteria. Use authoritative remote sources for missing or
freshness-sensitive assertions, frequencies, gene-disease validity, and criterion specifications.
Record which criteria were supported locally and which required remote evidence.

## Operating guides

Use the package-local guides in `references/`. The router file inventory is authoritative, and executable examples and clients are under `scripts/`.
