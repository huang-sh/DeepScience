# GO 2025 gene-set reference

## Snapshot

- Database: Gene Ontology (GO)
- Bundled release label: 2025
- Collections: Biological Process, Cellular Component, Molecular Function
- Identifier namespace: GO term identifiers and gene symbols
- Homepage: <http://geneontology.org>
- Resource overview: <https://doi.org/10.1093/nar/gky1055>

The files are a bundled gene-set export rather than a live GO API. The filenames do not encode
organism, evidence code, taxon, or retrieval date; report those fields as unavailable unless an
upstream record establishes them. Absence from this snapshot is not evidence that a current GO
annotation does not exist.

## Manifest

| Ontology | Relative path | Records |
| --- | --- | ---: |
| BP | `../assets/GO/GO_Biological_Process_2025.txt` | 5,343 |
| CC | `../assets/GO/GO_Cellular_Component_2025.txt` | 468 |
| MF | `../assets/GO/GO_Molecular_Function_2025.txt` | 1,174 |

## Line schema

Each line is a variable-width, tab-separated gene set:

```text
Term name (GO:NNNNNNN)<TAB><TAB>GENE1<TAB>GENE2<TAB>...<TAB>GENEN<TAB>
```

Empty fields may occur after the term and at line end. Discard empty fields when parsing. Preserve
gene order from the source file and keep each ontology record independent.

Normalized query output contains:

- `ontology`: `bp`, `cc`, or `mf`
- `term`: term name without the terminal GO identifier
- `label`: complete first field from the source record
- `go_id`: terminal `GO:NNNNNNN`
- `genes`: complete non-empty gene-symbol list
- `gene_count`: length of `genes`
- `source_file`: bundled filename
- `release`: `2025`

## Interpretation

- A specific GO ID is the strongest lookup key.
- A term-name match may return homonymous or closely related records across ontologies; retain
  their ontology labels.
- A reverse gene lookup reports membership in this snapshot, not all current GO annotations.
- A union or intersection is a derived set. Preserve the contributing GO IDs and operation when
  creating one.
