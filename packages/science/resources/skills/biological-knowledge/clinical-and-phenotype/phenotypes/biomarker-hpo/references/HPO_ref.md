# Human Phenotype Ontology (HPO) Query Reference

## Database Overview (for interpretation)

**Human Phenotype Ontology (HPO)** organizes and defines human disease phenotypes and supports computational inference (e.g., semantic similarity, ML) for genomic and phenotypic analyses. This resource uses the **MSigDB C5:HPO** gene sets.

- **HPO Homepage**: `https://hpo.jax.org/`
- **MSigDB C5 Collection**: `https://www.gsea-msigdb.org/gsea/msigdb/human/genesets.jsp?collection=C5`

## File

- Path: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/clinical-and-phenotype/phenotype/resources/c5.hpo.v2025.1.Hs.symbols.gmt`
- Metadata Path: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/clinical-and-phenotype/phenotype/resources/c5.hpo.v2025.1.Hs.txt`
- Format: **GMT** (tab-delimited; one gene set per line) and **JSON** (metadata), MSigDB v2025.1.Hs

## Header Schema (GMT)

This repository export is in **GMT (Gene Matrix Transposed)** format:

```text
gene_set_name	msigdb_url	gene_1	gene_2	...	gene_n
```

Notes:

- Column 1: `HP_PHENOTYPE_NAME` (MSigDB snake_case label)
- Column 2: MSigDB URL for the gene set
- Remaining columns: **0..N gene symbols** (variable length)

The **JSON** file provides additional metadata mapping `gene_set_name` to `hpo_id` (`exactSource`).

## Query Header

```python
import json
import pandas as pd

gmt_path = '$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/clinical-and-phenotype/phenotype/resources/c5.hpo.v2025.1.Hs.symbols.gmt'
json_path = '$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/clinical-and-phenotype/phenotype/resources/c5.hpo.v2025.1.Hs.json'

# Load GMT
df = pd.read_csv(gmt_path, sep='\t', header=None, dtype=str).fillna('')
df = df.rename(columns={0: 'phenotype_name', 1: 'msigdb_url'})
df['genes'] = df.iloc[:, 2:].apply(lambda r: [x for x in r.tolist() if x], axis=1)

# Load JSON metadata to map to HPO IDs
with open(json_path, 'r') as f:
    metadata = json.load(f)

df['hpo_id'] = df['phenotype_name'].apply(lambda x: metadata.get(x, {}).get('exactSource', ''))

print(df[['phenotype_name', 'hpo_id']].head(3))
print(df['genes'].head(3))
```

## Column Descriptions

- `phenotype_name`: GMT gene set name (snake_case)
- `msigdb_url`: MSigDB URL for the phenotype gene set
- `hpo_id`: extracted HPO ID from metadata (e.g., `HP:0000003`)
- `genes`: list of associated gene symbols for the phenotype (variable length)

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `hpo_id` (preferred stable key) or exact `phenotype_name`
- **Step 2 (optional)**: filter by presence of a gene symbol in `genes`

## Key Query Columns (关键词查询列)

1. **`hpo_id`**
2. **`phenotype_name`**
3. **`genes`**

## Key Abbreviations (关键缩写)

- **HPO**: Human Phenotype Ontology
- **PMID**: PubMed ID

## Source / Citation

- **Primary source**: [Human Phenotype Ontology (HPO)](https://hpo.jax.org/)
- **Data provider**: [MSigDB (Molecular Signatures Database)](https://www.gsea-msigdb.org/gsea/msigdb/) - C5 (HPO) collection v2025.1.Hs
- Paper title (HPO): **The Human Phenotype Ontology in 2024: phenotypes around the world**
- Citation:
  - *Nucleic Acids Research* (2024)
  - PMID: **37953324**
  - DOI: **10.1093/nar/gkad1005**
- Data license / terms: See MSigDB and HPO terms of use.


