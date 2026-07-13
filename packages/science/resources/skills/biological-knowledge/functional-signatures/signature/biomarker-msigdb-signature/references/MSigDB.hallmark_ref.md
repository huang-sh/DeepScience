# MSigDB Hallmark Gene Sets Query Reference

- **Version**: MSigDB Hallmark v2025.1 (local export)
- **Paper year**: 2015

## Database Overview (for interpretation)

The **MSigDB Hallmark** collection provides 50 curated gene sets representing well‑defined biological processes. The local resources include GMT and JSON exports for the human hallmark sets.

- **Homepage**: `https://www.gsea-msigdb.org/gsea/msigdb/`
- **Scope**:
  - Hallmark gene sets (HALLMARK_*)
  - GMT and JSON exports with gene members and metadata

### Paper info (for context)

- **Paper title**: The Molecular Signatures Database (MSigDB) hallmark gene set collection
- **Journal**: Cell Systems, 2015
- **DOI**: 10.1016/j.cels.2015.12.004

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/functional_signatures/signature/resources/hallmark`
- **Formats**: GMT, JSON
- **Files**:
  - `MSigDB.hallmark.all.v2025.1.Hs.symbols.gmt`
  - `MSigDB.hallmark.all.v2025.1.Hs.json`

## Header / Line Schema

### GMT (MSigDB.hallmark.all.v2025.1.Hs.symbols.gmt)

Each line is a variable-length, tab-separated record:

```text
gene_set_name\tmsigdb_url\tgene1\tgene2\t...\tgeneN
```

### JSON (MSigDB.hallmark.all.v2025.1.Hs.json)

Top-level keys are hallmark gene set names. Each value is a JSON object with fields such as:

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
    'agentspace/resource/biomarker/functional_signatures/signature/resources/hallmarkMSigDB.hallmark.all.v2025.1.Hs.symbols.gmt',
)
with open(gmt_path, 'r', encoding='utf-8') as f:
    line = f.readline().rstrip('\n')
    fields = line.split('\t')
    gene_set = fields[0]
    url = fields[1]
    genes = fields[2:]
    print(gene_set, url, len(genes))

# JSON example
json_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/functional_signatures/signature/resources/hallmarkMSigDB.hallmark.all.v2025.1.Hs.json',
)
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    sample_key = next(iter(data))
    print(sample_key, data[sample_key].keys())
```

## Column / Field Descriptions

### GMT fields

- **gene_set_name**: Hallmark gene set name (e.g., `HALLMARK_ADIPOGENESIS`).
- **msigdb_url**: MSigDB link for the gene set.
- **gene1..geneN**: Member gene symbols.

### JSON fields (per gene set)

- **collection**: Collection label (e.g., `H` for Hallmark).
- **systematicName**: MSigDB systematic name.
- **pmid**: PMID for the Hallmark reference.
- **externalDetailsURL**: External details URL for the gene set.
- **msigdbURL**: MSigDB gene set URL.
- **geneSymbols**: Member gene symbols list.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: hallmark gene set name
- **Step 2 (exact/contains)**: gene symbol
- **Step 3 (exact)**: PMID (JSON)

## Key Query Columns (关键词查询列)

1. **`gene_set_name`**
2. **`gene symbols`**
3. **`msigdb_url`**
4. **`externalDetailsURL`**
5. **`pmid`**
