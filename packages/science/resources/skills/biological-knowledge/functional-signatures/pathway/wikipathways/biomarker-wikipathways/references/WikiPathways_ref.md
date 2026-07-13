# WikiPathways GMT Query Reference

- **Version**: WikiPathways 2026-01-10 GMT exports
- **Paper year**: 2024

## Database Overview (for interpretation)

**WikiPathways** is an open, community-curated pathway database. The local resources contain species-specific pathway gene sets in GMT format.

- **Homepage**: `https://www.wikipathways.org/`
- **Scope**:
  - Species‑specific pathway gene sets
  - GMT formatted pathway signatures

### Paper info (for context)

- **Paper title**: WikiPathways 2024: next generation pathway database
- **Journal**: Nucleic Acids Research, 2024
- **DOI**: 10.1093/nar/gkad960

## Files

- **Path**: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/functional_signatures/pathway/resources/WikiPathways/`
- **Format**: GMT (tab-separated), one pathway per line.
- **Files (species)**:
  - `wikipathways-20260110-gmt-Homo_sapiens.gmt`
  - `wikipathways-20260110-gmt-Mus_musculus.gmt`
  - `wikipathways-20260110-gmt-Rattus_norvegicus.gmt`
  - `wikipathways-20260110-gmt-Danio_rerio.gmt`
  - `wikipathways-20260110-gmt-Drosophila_melanogaster.gmt`
  - `wikipathways-20260110-gmt-Caenorhabditis_elegans.gmt`
  - `wikipathways-20260110-gmt-Saccharomyces_cerevisiae.gmt`
  - `wikipathways-20260110-gmt-Arabidopsis_thaliana.gmt`
  - `wikipathways-20260110-gmt-Zea_mays.gmt`
  - `wikipathways-20260110-gmt-Solanum_lycopersicum.gmt`
  - `wikipathways-20260110-gmt-Populus_trichocarpa.gmt`
  - `wikipathways-20260110-gmt-Bos_taurus.gmt`
  - `wikipathways-20260110-gmt-Equus_caballus.gmt`
  - `wikipathways-20260110-gmt-Sus_scrofa.gmt`
  - `wikipathways-20260110-gmt-Gallus_gallus.gmt`
  - `wikipathways-20260110-gmt-Pan_troglodytes.gmt`
  - `wikipathways-20260110-gmt-Anopheles_gambiae.gmt`

## Line Schema

Each line is a variable-length, tab-separated record:

```text
pathway_meta\tpathway_url\tgene1\tgene2\t...\tgeneN
```

Where `pathway_meta` is a single field with the pattern:

```text
PathwayName%WikiPathways_YYYYMMDD%WPID%Species
```

## Query Header

```python
import os

file_path = os.path.join(
    '$CLAUDE_PROJECT_DIR',
    'agentspace/resource/biomarker/functional_signatures/pathway/resources/WikiPathways/wikipathways-20260110-gmt-Homo_sapiens.gmt',
)

with open(file_path, 'r', encoding='utf-8') as f:
    line = f.readline().rstrip('\n')
    fields = line.split('\t')
    meta = fields[0]
    url = fields[1]
    genes = fields[2:]
    print(meta)
    print(url)
    print('genes_in_set:', len(genes))
```

## Column Descriptions

- **pathway_meta**: Pathway name + WikiPathways release + WPID + species (percent‑delimited).
- **pathway_url**: WikiPathways URL for the pathway.
- **gene1..geneN**: Member gene identifiers (species-specific IDs).

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: pathway name or WPID (from `pathway_meta`)
- **Step 2 (exact/contains)**: gene identifiers

## Key Query Columns (关键词查询列)

1. **`pathway_meta`**
2. **`pathway_url`**
3. **`gene identifiers`**
