---
name: experimental-data
description: "Experimental data: discover and acquire raw or near-raw measurements, sample-level observations, and reusable datasets from sequencing, transcriptomics, single-cell, perturbation, proteomics, metabolomics, genomics, and structural-biology repositories. Use for study or sample metadata, matrices, reads, spectra, experimental structures, and downloadable research artifacts—not curated database assertions or reference marker collections."
category: experimental-data
license: Mixed
metadata:
  access-mode: hybrid
  collection: experimental-data
---

# Experimental Data

Select by study design before retrieval. The `resource` tool discloses package metadata and
instructions only after selection. Package-relative scripts, references, and assets support the
Agent's task-specific execution; they are not fixed query functions.

## Workflow

1. Define organism, biological system, condition, assay, study design, sample unit, required format,
   processing level, and reuse constraints. This step is complete when every known constraint and
   every unresolved requirement is explicit.

2. Browse the closest modality and compare the complete leaf metadata:

   `resource({ action: "list", category: "experimental-data/transcriptomics" })`

   This step is complete when `kind` is `resource_metadata` and every returned candidate has been
   compared against the request.

3. Load each selected package with its exact exposed name:

   `resource({ action: "read", name: "biomarker-geo" })`

   This step is complete when each selected package's query interface, schema, access mode, and
   package-relative scripts, references, assets, and file conventions are known.

4. Accept a dataset only after verifying organism, assay, sample count, groups, processing state,
   access conditions, file sizes, checksums when available, and repository version. This step is
   complete when every candidate has an explicit inclusion or exclusion reason and every selected
   file is accounted for.

5. Write manifests, raw responses, downloaded files, and normalized metadata to the Session
   workspace. Report accession, retrieval date, selected files, sizes, checksums, and failures.
   This step is complete when every selected package has a result, a valid empty result, or a
   concrete failure and every artifact path is reported.

Use package directories as read-only sources; all generated output belongs in the Session workspace.
