# Reactome pathway gene-set contract

Read this reference when the requested output is the genes assigned to a Reactome pathway. Use
`participants-schema.md` instead when the task asks about proteins, complexes, molecular sets,
small molecules, or drugs.

## Command

Discover a stable ID locally when the user supplies a pathway name:

```bash
python3 <resource-dir>/scripts/reactome_query.py gene-set-find "cholesterol" \
  --species "Homo sapiens" \
  --output reactome-gene-set-find.json
```

Then retrieve the selected exact row:

```bash
python3 <resource-dir>/scripts/reactome_query.py gene-set R-HSA-191273 \
  --species "Homo sapiens" \
  --output reactome-cholesterol.genes.json
```

The command reads the extracted official Reactome v97 `ReactomePathways.gmt`, selects exactly one
row by stable ID, and writes:

- `reactome-cholesterol.genes.json`: complete gene-symbol membership;
- `reactome-cholesterol.genes.source.gmt`: workspace copy of the official GMT source;
- `reactome-cholesterol.genes.provenance.json`: release, source URL and hash, parameters, result
  hash, snapshot manifest, and validation checks.

## Result schema

```json
{
  "schemaVersion": 1,
  "database": "Reactome",
  "operation": "gene-set",
  "stableId": "R-HSA-191273",
  "pathwayName": "Cholesterol biosynthesis",
  "species": "Homo sapiens",
  "reactomeVersion": "97",
  "scope": "ReactomePathways.gmt exported pathway membership",
  "accessMode": "local bundled snapshot",
  "identifierNamespace": "gene symbol",
  "geneCount": 27,
  "genes": ["ACAT2", "ARV1"]
}
```

This is the official pathway gene-set export, not a conversion from participant display names.
Keep its scope distinct from direct reaction participants and from Analysis Service enrichment
inputs or hits.

## Acceptance checks

- For name discovery, require every returned match to contain `pathwayName`, `stableId`, and
  `geneCount`; copy the selected stable ID exactly into `gene-set`.
- Require the command manifest and provenance `validation.status` to be `passed`.
- Require an exact stable-ID row and a species-compatible stable-ID prefix.
- Require `geneCount == genes.length` with unique, non-empty gene symbols.
- Verify the workspace source GMT and result JSON against their provenance SHA-256 values.
- Report Reactome release 97 and `gene symbol` as the identifier namespace.
