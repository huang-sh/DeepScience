# GTRD TF Target Gene Sets Query Reference

- **Version**: GTRD v2025.1 (local export)
- **Paper year**: 2021

## Database Overview (for interpretation)

**GTRD** (Gene Transcription Regulation Database) provides uniformly processed transcription regulation datasets and TF binding site annotations. The local resources contain TF target gene sets derived from the GTRD uniform processing pipeline (promoter regions −1000 to +100 bp around TSS).

- **Homepage**: `http://gtrd.biouml.org/`
- **Scope**:
  - Human TF target gene sets
  - MSigDB C3:TFT:GTRD collection exports

### Paper info (for context)

- **Paper title**: GTRD: an integrated view of transcription regulation
- **Journal**: Nucleic Acids Research, 2021
- **DOI**: 10.1093/nar/gkaa1057

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/GTRD/`
- **Formats**: GMT, JSON
- **Files**:
  - `c3.tft.gtrd.v2025.1.Hs.symbols.gmt`
  - `c3.tft.gtrd.v2025.1.Hs.json`

## Header / Line Schema

### GMT (c3.tft.gtrd.v2025.1.Hs.symbols.gmt)

Each line is a variable-length, tab-separated record:

```text
tf_target_set\tmsigdb_url\tgene1\tgene2\t...\tgeneN
```

### JSON (c3.tft.gtrd.v2025.1.Hs.json)

Top-level keys are TF target set names. Each value is a JSON object with fields such as:

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
    'agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/GTRD/c3.tft.gtrd.v2025.1.Hs.symbols.gmt',
)
with open(gmt_path, 'r', encoding='utf-8') as f:
    line = f.readline().rstrip('\n')
    fields = line.split('\t')
    tf_set = fields[0]
    url = fields[1]
    genes = fields[2:]
    print(tf_set, url, len(genes))

# JSON example
json_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/RNA_Regulation/Transcriptional_Regulation/transcription-factor/resources/GTRD/c3.tft.gtrd.v2025.1.Hs.json',
)
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    sample_key = next(iter(data))
    print(sample_key, data[sample_key].keys())
```

## Column / Field Descriptions

### GMT fields

- **tf_target_set**: TF target gene set name (e.g., `ADA2_TARGET_GENES`).
- **msigdb_url**: MSigDB link for the gene set.
- **gene1..geneN**: Target gene symbols.

### JSON fields (per TF set)

- **collection**: Collection label (e.g., `C3:TFT:GTRD`).
- **systematicName**: MSigDB systematic name.
- **pmid**: PMID for the GTRD reference.
- **externalDetailsURL**: External details URL for the TF set.
- **msigdbURL**: MSigDB gene set URL.
- **geneSymbols**: Target gene symbols list.

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: TF target set name
- **Step 2 (exact/contains)**: target gene symbol
- **Step 3 (exact)**: PMID (JSON)

## Key Query Columns (关键词查询列)

1. **`tf_target_set`**
2. **`gene symbols`**
3. **`msigdb_url`**
4. **`externalDetailsURL`**
5. **`pmid`**
