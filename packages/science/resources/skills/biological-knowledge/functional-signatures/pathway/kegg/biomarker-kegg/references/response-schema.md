# KEGG connector response schema

Read this reference before consuming output from `scripts/query_kegg.py`. Every JSON response has
`schemaVersion: 1`, an `operation`, and named fields; positional `rows` are not part of this
contract.

## `find`

```json
{
  "operation": "find",
  "count": 1,
  "matches": [
    {"pathwayId": "map04979", "description": "Cholesterol metabolism"}
  ]
}
```

`count` is the number of bounded search hits in `matches`. Copy `pathwayId` from the selected
record; the connector resolves `mapNNNNN` to the requested organism during `genes`.

## `genes`

```json
{
  "operation": "genes",
  "requestedQuery": "map04979",
  "resolvedQuery": "hsa04979",
  "count": 52,
  "genes": [
    {"pathwayId": "path:hsa04979", "geneId": "hsa:10577"}
  ],
  "identifierNamespace": "KEGG organism-prefixed gene ID"
}
```

`genes` contains the complete KEGG link response for the selected pathway. Derive membership from
`genes[].geneId`; `count` must equal `genes.length`.

## `info`

`record` is the complete KEGG flat-file text returned by `/get/<identifier>`. Use it for pathway
metadata, not gene membership when the `genes` operation is available.

## `snapshot`

```json
{
  "operation": "snapshot",
  "snapshot": "KEGG 2026",
  "organism": "Homo sapiens",
  "taxonId": 9606,
  "count": 1,
  "matches": [
    {
      "pathwayId": null,
      "pathwayName": "CHOLESTEROL METABOLISM",
      "description": null,
      "geneCount": 51,
      "genes": ["ABCG8", "MYLIP"],
      "identifierNamespace": "gene symbol",
      "sourceLine": 204
    }
  ]
}
```

The bundled TXT schema is `pathway_name<TAB>reserved_description<TAB>gene...`; the current Homo
sapiens export
leaves `reserved_description` empty and may end a line with a trailing tab. The connector handles
both positions and emits only non-empty genes. For every match, `geneCount` must equal
`genes.length`. `pathwayId` is explicitly `null` because this bundled snapshot contains pathway
names and gene symbols but no KEGG pathway-ID field. A name match does not establish an ID. Report
the ID as unavailable from the snapshot, or run the documented live `find` operation when the task
requires a current KEGG ID and save that response as a separate artifact.

## Acceptance checks

- Confirm `schemaVersion` is `1` and `operation` matches the requested branch.
- For snapshot results, require organism `Homo sapiens`, taxon ID `9606`, validation status
  `passed`, and a source SHA-256 matching `assets/KEGG/manifest.json`.
- Confirm every reported identifier is a non-null value in its documented artifact field.
- Confirm each reported count equals the corresponding array length.
- Keep live KEGG IDs and snapshot gene symbols as separate evidence streams.
