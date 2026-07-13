---
name: biological-knowledge
description: "Biological knowledge: query curated assertions and reference databases for genes, variants, pathways, regulation, cell types, reference atlases, perturbation-derived relationships, phenotypes, therapeutic targets, drugs, interactions, annotations, signatures, compounds, and predicted structures. Use for identifiers, marker sets, gene sets, associations, ontologies, database facts, and cross-database coverage."
category: biological-knowledge
license: Mixed
metadata:
  access-mode: hybrid
  collection: biological-knowledge
---

# Biological Knowledge

Route first, query second. Select sources by entity type, organism, identifier namespace, evidence
model, and release. The `resource` tool progressively exposes database metadata and instructions;
the Agent determines the task-specific execution from each loaded package.

## Workflow

1. Record the requested entity, organism, namespace, evidence type, freshness requirement, and any
   named database. A named database selects that source; an unnamed database-dependent set request
   selects every scientifically applicable package returning the requested entity type. This step
   is complete when the source inclusion and exclusion rules are explicit.

2. Browse the relevant domain with `resource({ action: "list", category:
   "<selected-category-path>" })`. When the response has `kind: "categories"`, choose an exact
   child `path` and list it; repeat until the response has `kind: "resource_metadata"`. Category
   entries are navigation choices, while `resource_metadata` entries are selectable packages.

   This step is complete when every branch matching the inclusion rules from step 1 has reached
   `resource_metadata` and every returned candidate has been compared by scientific scope,
   organism, entity type, and access mode.

3. Load only the selected package instructions using the exact `name` copied from its leaf
   metadata:

   `resource({ action: "read", name: "<exact-resource-name>" })`

   Treat the loaded `RESOURCE.md` as the authoritative access contract. Follow its reference
   routing before data access: read the named schema or interpretation reference when the requested
   result depends on entity filtering, member counting, identifier mapping, pagination, or endpoint
   semantics. Inspect a bundled script's `--help` or source only when the package documentation does
   not state the required invocation. Use the loaded package contract as the source of
   database-specific access instructions.

   This step is complete when each selected package's query interface, response schema, identifier
   semantics, version behavior, required references, and path conventions are known well enough to
   define the intended result before querying.

4. Build a retrieval ledger with one row per selected package: exact package name, discovery
   operation when an ID is unknown, complete retrieval operation, documented output schema, and
   intended raw artifact. Execute each package according to its loaded access contract. Use live
   services for `remote` and bundled snapshots for `local`.

   For `hybrid`, apply the package's local coverage gate before any network call. Local coverage is
   sufficient only when the available data—not merely documentation or a client script—matches the
   requested operation, entity, organism, identifier namespace, release requirement, and complete
   membership or fields. Use that local result alone when the gate passes. Escalate only the
   uncovered request to the documented remote service when the gate fails, the local result is a
   valid empty result, or the user requires current/live data or independent remote validation.
   Record the gate decision and fallback reason; keep local and remote evidence separate when both
   were explicitly required.

   Give each selected record one complete retrieval. Use a separate discovery request only when
   the exact record ID is unknown. Prefer a package's structured output option and treat its
   documented schema as the contract. Let one workspace consolidation script be the first consumer
   of completed raw outputs: read every selected output once, perform task-specific filtering and
   mapping, and write all derived source artifacts and provenance in one run. Then validate all
   output schemas, array lengths, hashes, and reported counts in one pass. Additional inspection is
   reserved for a failed documented-schema check, changed parameters, pagination, recovery, or an
   independent validation request.

   This step is complete when every ledger row has one result, a valid empty result, or a concrete
   failure, and every successful row points to its raw and derived artifacts.

5. Pass the runtime **Artifact report gate**. Preserve complete results in canonical workspace
   artifacts, then report every source independently with its database, query or record, organism,
   namespace, release or retrieval date, access mode, exact result count, and artifact path.
   Perform merging or identifier mapping only when requested.

   This step is complete when all selected sources and returned members are accounted for in the
   artifacts; every reported identifier is present in a documented artifact field; every reported
   count is computed from an artifact field; and complete membership lists remain in deterministic
   artifacts rather than model-composed prose.

Interpret an empty response as version-specific evidence. Use package directories as read-only
sources and write all generated output to the Session workspace.
