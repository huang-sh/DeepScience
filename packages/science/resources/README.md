# DeepScience scientific resources

This directory contains DeepScience's bundled, read-only scientific resources.

- `skills/experimental-data/SKILL.md`, `skills/biological-knowledge/SKILL.md`, and
  `skills/literature/SKILL.md` are independent Agent-facing Resource Skills.
- Nested `RESOURCE.md` packages contain source-specific instructions, scripts, references, and assets.
- `resource_tree.json` is the Resource Library UI projection of those packages.

The three Skills are divided by evidence object:

- `experimental-data/`: downloadable observations and reusable datasets.
- `biological-knowledge/`: curated biological assertions, annotations, and reference databases.
- `literature/`: publications, clinical-trial records, and patents.

The collection combines the original Biobot resources with the former
`packages/science/skills/databases` library. Database duplicates such as Ensembl, UniProt,
Reactome, STRING, PDB, ChEMBL, Open Targets, PubChem, HMDB, and AlphaFold are consolidated in
one package each. Complementary clients and guides live directly under each package's `scripts/`
and `references/` directories.

## Agent exposure

The ordinary Skill Catalog does not scan these packages. The separate `resource` tool exposes
`experimental-data`, `biological-knowledge`, and `literature` as three peer top-level Resource
Skills. Their Pi-style metadata is embedded directly in the runtime `<available_skills>` block, so
the Agent can load one immediately with `resource({ action: "read", name: "<exact-name>" })` without
an initial list call. After one is loaded, the same tool progressively discloses its nested database
categories, exact package metadata, and selected `RESOURCE.md` instructions. Scripts, references,
and assets remain package-relative materials that the Agent may inspect and use according to the
task; they are not fixed database query functions. Loaded top-level Resources are persisted
separately from loaded ordinary Skills.

Validate package metadata and duplicate names after changing the collection:

```bash
npm run resources:sync
npm run resources:validate
```
