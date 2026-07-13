# ImmuneSigDB Query Reference

- **Version**: ImmuneSigDB v2025.1 (local export)
- **Paper year**: 2016

## Database Overview (for interpretation)

**ImmuneSigDB** is a curated collection of immunologic gene signatures derived from human and mouse immunology studies. The local resources include GMT and JSON exports from the MSigDB C7 collection.

- **Homepage**: `https://www.gsea-msigdb.org/gsea/msigdb/collections.jsp#C7`
- **Scope**:
  - Immunologic gene signatures (C7)
  - GMT and JSON exports with gene members and metadata

### Paper info (for context)

- **Paper title**: Compendium of Immune Signatures Identifies Conserved and Species-Specific Biology in Response to Inflammation
- **Journal**: Immunity, 2016
- **DOI**: 10.1016/j.immuni.2015.12.006

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/functional_signatures/signature/resources/ImmuneSigDB/`
- **Formats**: GMT, JSON
- **Files**:
  - `c7.immunesigdb.v2025.1.Hs.symbols.gmt`
  - `c7.immunesigdb.v2025.1.Hs.json`

## Header / Line Schema

### GMT (c7.immunesigdb.v2025.1.Hs.symbols.gmt)

Each line is a variable-length, tab-separated record:

```text
signature_name\tmsigdb_url\tgene1\tgene2\t...\tgeneN
```

### JSON (c7.immunesigdb.v2025.1.Hs.json)

Top-level keys are signature names. Each value is a JSON object with fields such as:

```text
collection, systematicName, pmid, externalDetailsURL, msigdbURL, geneSymbols
```

## Query Header

```python
import os
import json

# GMT example
gmt_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/functional_signatures/signature/resources/ImmuneSigDB/c7.immunesigdb.v2025.1.Hs.symbols.gmt',
)
with open(gmt_path, 'r', encoding='utf-8') as f:
    line = f.readline().rstrip('\n')
    fields = line.split('\t')
    signature = fields[0]
    url = fields[1]
    genes = fields[2:]
    print(signature, url, len(genes))

# JSON example
json_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/functional_signatures/signature/resources/ImmuneSigDB/c7.immunesigdb.v2025.1.Hs.json',
)
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    sample_key = next(iter(data))
    print(sample_key, data[sample_key].keys())
```

## Column / Field Descriptions

### GMT fields

- **signature_name**: ImmuneSigDB signature name.
- **msigdb_url**: MSigDB link for the signature.
- **gene1..geneN**: Member gene symbols.

### JSON fields (per signature)

- **collection**: Collection label (e.g., `C7:IMMUNESIGDB`).
- **systematicName**: MSigDB systematic name.
- **pmid**: PMID for the ImmuneSigDB reference.
- **externalDetailsURL**: External details URL for the signature.
- **msigdbURL**: MSigDB signature URL.
- **geneSymbols**: Member gene symbols list.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: signature name
- **Step 2 (exact/contains)**: gene symbol
- **Step 3 (exact)**: PMID (JSON)

## Key Query Columns (关键词查询列)

1. **`signature_name`**
2. **`gene symbols`**
3. **`msigdb_url`**
4. **`externalDetailsURL`**
5. **`pmid`**
