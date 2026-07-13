# Reactome participants response and member interpretation

Read this reference before turning `participants` output into a pathway member set or count.

## Contents

- [Connector endpoint](#connector-endpoint)
- [Response structure](#response-structure)
- [Counting contracts](#counting-contracts)
- [One-fetch workflow](#one-fetch-workflow)
- [Validation](#validation)

## Connector endpoint

The bundled connector command

```bash
python3 <resource-dir>/scripts/reactome_query.py participants R-HSA-191273 \
  --output reactome-participants.raw.json
```

calls `GET https://reactome.org/ContentService/data/participants/{stable-id}` and writes the
complete JSON response. The response is a list of participating PhysicalEntity records, not a gene
list. The same invocation also writes:

- `reactome-participants.raw.summary.json`: deterministic PhysicalEntity and ReferenceEntity views;
- `reactome-participants.raw.provenance.json`: endpoint, stable ID, species, version, UTC retrieval
  time, parameters, raw file hash, complete `query` and `version` responses, and validation checks.

The command exits with an error unless the participants response is a list, the queried stable ID
matches, species is present, and the Reactome version is present.

## Response structure

Each top-level record describes a PhysicalEntity:

```json
{
  "peDbId": 196423,
  "displayName": "DHCR7 [endoplasmic reticulum membrane]",
  "schemaClass": "EntityWithAccessionedSequence",
  "refEntities": [
    {
      "stId": "uniprot:Q9UBM7",
      "identifier": "Q9UBM7",
      "schemaClass": "ReferenceGeneProduct",
      "displayName": "UniProt:Q9UBM7 DHCR7"
    }
  ]
}
```

Top-level `schemaClass` commonly includes:

- `EntityWithAccessionedSequence`: a sequence-bearing physical entity.
- `SimpleEntity`: a small molecule or other non-sequence entity.
- `Complex`: a molecular complex; its flattened references may appear in `refEntities`.
- `DefinedSet`: a defined set of alternative or related entities.

Nested `refEntities[].schemaClass` determines the native reference type:

- `ReferenceGeneProduct`: canonical UniProt-referenced gene product.
- `ReferenceIsoform`: UniProt isoform-specific gene product.
- `ReferenceMolecule`: ChEBI-referenced small molecule.
- `ReferenceTherapeutic`: therapeutic or drug reference.

Classify entities from `schemaClass` and `identifier`; use `displayName` only as descriptive text.

## Counting contracts

Choose and label the count that answers the user request:

| Requested result | Definition |
|---|---|
| Physical participants | Unique top-level `peDbId`; includes proteins, complexes, sets, and small molecules. |
| Native protein accessions | Unique `identifier` from `ReferenceGeneProduct` and `ReferenceIsoform`; preserve isoform suffixes. |
| Base UniProt accessions | Same protein references, with a terminal numeric isoform suffix such as `-2` removed; label this normalization explicitly. |
| Small molecules | Unique `identifier` from `ReferenceMolecule`; report separately from proteins. |
| Gene symbols | Requires an explicit, validated UniProt-to-gene mapping; `displayName` is not a validated mapping source. |

Label PhysicalEntity, protein, small-molecule, and therapeutic counts separately. Preserve
complexes and sets in the raw response even when a derived view reports their flattened reference
products.

## One-fetch workflow

1. Run `participants <stable-id> --output <raw.json>` once. Accept the retrieval only when its
   output manifest reports `validation: "passed"` and all three artifact paths exist.
2. Use the generated summary for native PhysicalEntity, protein, base-UniProt, small-molecule, and
   therapeutic views. It intentionally emits no gene symbols.
3. Produce task-specific mappings and tables from the raw and summary files in one consolidation
   pass. Record the filtering definition and isoform policy beside every derived count.

Re-run `participants` only when the first response failed or was incomplete, the stable ID changed,
the user requested a fresh independent retrieval, or Reactome version provenance requires a new
response.

This branch is complete when the validated raw, summary, and provenance files account for the
endpoint, stable ID, species, Reactome version, retrieval time, verification responses, filtering
definition, isoform policy, and every reported count.

## Validation

Before reporting:

- confirm the raw response is valid JSON and non-truncated;
- confirm the provenance artifact records the pathway stable ID, species, Reactome database
  version, retrieval time, endpoint or action, parameters, raw response path, and complete `query`
  and `version` verification responses;
- confirm provenance `validation.status` is `passed` and its raw SHA-256 matches the saved file;
- report native identifier namespaces;
- state whether isoforms were preserved or collapsed;
- report unmapped identifiers when a gene-symbol mapping was requested;
- keep the raw response and derived outputs in the Session workspace.
