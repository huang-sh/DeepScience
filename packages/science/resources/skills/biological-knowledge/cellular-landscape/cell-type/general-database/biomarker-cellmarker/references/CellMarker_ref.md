# CellMarker 2.0 Database Query Reference

## Database Overview (for interpretation)

**CellMarker 2.0** is an updated, manually curated database of cell markers in human and mouse. It provides a collection of experimentally supported markers of various cell types across different tissues. The current release significantly expands on the original version, incorporating single-cell sequencing data and new marker types.

- **Homepage**: `http://bio-bigdata.hrbmu.edu.cn/CellMarker/` or `http://117.50.127.228/CellMarker/`
- **Scope**:
  - 83,361 tissue-cell type-marker entries
  - 2,578 cell types, 656 tissues, 26,915 cell markers
  - Human and Mouse
  - Includes markers from 48 sequencing technologies (e.g., 10X Chromium, Smart-Seq2, Drop-seq).
  - Includes 29 types of cell markers (protein-coding genes, lncRNA, processed pseudogenes, etc.).

### Paper info (for context)

- Paper title: **CellMarker 2.0: an updated database of manually curated cell markers in human/mouse and web tools based on scRNA-seq data**
- Abstract: CellMarker 2.0 is an updated database that provides a manually curated collection of experimentally supported markers of various cell types in different tissues of human and mouse. In addition, web tools for analyzing single cell sequencing data are described. The current release recruits 26,915 cell markers, 2,578 cell types and 656 tissues, resulting in a total of 83,361 tissue-cell type-marker entries. New features include data from 48 sequencing technologies and 29 types of cell markers.
- Citation: *Nucleic Acids Research* (2022)
- PMID: **36350645**
- DOI: **10.1093/nar/gkac947**

## File

- Path: `$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/Cellular_landscape/cell_type/General-database/resources/Cell_marker_All.csv`
- Format: CSV (comma-separated), header row present

## Header Schema

```text
species,tissue_class,tissue_type,uberonongology_id,cancer_type,cell_type,cellontology_id,marker,Symbol,GeneID,Genetype,Genename,UNIPROTID,technology_seq,marker_source,PMID,Title,journal,year
```

## Query Header

```python
import pandas as pd

# Read the CSV file
df = pd.read_csv('$CLAUDE_PROJECT_DIR/agentspace/resource/biomarker/Cellular_landscape/cell_type/General-database/resources/Cell_marker_All.csv')

# View column names
print(df.columns.tolist())

# View first row
print(df.head(1))
```

## Column Descriptions

- `species`: Species (Human, Mouse)
- `tissue_class`: Tissue class classification
- `tissue_type`: Specific tissue type
- `uberonongology_id`: UBERON ontology identifier
- `cancer_type`: Cancer status (e.g., Normal, Cancer)
- `cell_type`: Cell type name
- `cellontology_id`: Cell Ontology identifier
- `marker`: Marker name
- `Symbol`: Gene symbol
- `GeneID`: Gene identifier
- `Genetype`: Type of gene (e.g., protein_coding, lncRNA)
- `Genename`: Full gene name
- `UNIPROTID`: UniProt protein identifier
- `technology_seq`: Sequencing technology (e.g., 10x Chromium)
- `marker_source`: Source of marker evidence (e.g., Single-cell sequencing, Experiment)
- `PMID`: PubMed ID
- `Title`: Publication title
- `journal`: Journal name
- `year`: Publication year

## Recommended query order (语序 / 渐进式精确匹配)

- **Step 1 (exact)**: `Symbol` / `marker` (gene symbol), `cell_type`
- **Step 2 (exact)**: `species`, `tissue_type`, `cancer_type`, `marker_source`
- **Step 3 (exact, optional)**: `PMID`, `GeneID`, `UNIPROTID`, `cellontology_id`
- **Do not restrict by default**: `Genename`, `Title`, `journal`, `technology_seq` (use for context)

## Key Query Columns (关键词查询列)

1. **`species`**
2. **`tissue_type`**
3. **`cell_type`**
4. **`marker`** / **`Symbol`**
5. **`cancer_type`**


## Unique Values Summary (Reference)

- **Species**: Human, Mouse
- **Gene Types**: 24+ types including `protein_coding`, `lncRNA`, `processed_pseudogene`, etc.
- **Marker Sources**: `Single-cell sequencing`, `Experiment`, `Review`, `Company`.
- **Technologies**: 60+ technologies including `10x Chromium`, `Smart-seq2`, `Drop-seq`, etc.
