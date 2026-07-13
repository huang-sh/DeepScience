#!/usr/bin/env python3
"""Query the bundled GO 2025 term-to-gene files without loading them into model context."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Iterable

RELEASE = "2025"
RESOURCE_ROOT = Path(__file__).resolve().parent.parent
DATA_FILES = {
    "bp": RESOURCE_ROOT / "assets" / "GO" / "GO_Biological_Process_2025.txt",
    "cc": RESOURCE_ROOT / "assets" / "GO" / "GO_Cellular_Component_2025.txt",
    "mf": RESOURCE_ROOT / "assets" / "GO" / "GO_Molecular_Function_2025.txt",
}
GO_ID = re.compile(r"\((GO:\d{7})\)\s*$", re.IGNORECASE)


def parse_record(line: str, ontology: str, source: Path) -> dict[str, object] | None:
    fields = [field.strip() for field in line.rstrip("\r\n").split("\t")]
    if not fields or not fields[0]:
        return None
    label = fields[0]
    match = GO_ID.search(label)
    go_id = match.group(1).upper() if match else ""
    term = label[: match.start()].strip() if match else label
    genes = [field for field in fields[1:] if field]
    return {
        "ontology": ontology,
        "term": term,
        "label": label,
        "go_id": go_id,
        "genes": genes,
        "gene_count": len(genes),
        "source_file": source.name,
        "release": RELEASE,
    }


def records(ontologies: Iterable[str]) -> Iterable[dict[str, object]]:
    for ontology in ontologies:
        source = DATA_FILES[ontology]
        with source.open("r", encoding="utf-8") as handle:
            for line in handle:
                record = parse_record(line, ontology, source)
                if record is not None:
                    yield record


def select(record: dict[str, object], mode: str, query: str) -> bool:
    normalized = query.casefold().strip()
    label = str(record["label"]).casefold()
    term = str(record["term"]).casefold()
    go_id = str(record["go_id"]).casefold()
    genes = [str(gene).casefold() for gene in record["genes"]]
    if mode == "term":
        return normalized in {label, term, go_id}
    if mode == "search":
        return normalized in label or normalized in go_id
    return normalized in genes


def write_json(result: dict[str, object], destination: Path | None) -> None:
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if destination is None:
        sys.stdout.write(text)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text, encoding="utf-8")


def write_tsv(matches: list[dict[str, object]], destination: Path | None) -> None:
    handle = destination.open("w", encoding="utf-8", newline="") if destination else sys.stdout
    try:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["ontology", "term", "go_id", "gene", "source_file", "release"])
        for record in matches:
            genes = record["genes"] or [""]
            for gene in genes:
                writer.writerow(
                    [record["ontology"], record["term"], record["go_id"], gene, record["source_file"], RELEASE]
                )
    finally:
        if destination is not None:
            handle.close()


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Query bundled GO 2025 gene sets.")
    command.add_argument("mode", choices=("term", "search", "gene"))
    command.add_argument("query", help="GO ID, term text, or gene symbol")
    command.add_argument("--ontology", choices=("all", "bp", "cc", "mf"), default="all")
    command.add_argument("--format", choices=("json", "tsv"), default="json")
    command.add_argument("--output", type=Path, help="Output path; relative paths use the current workspace")
    return command


def main() -> int:
    args = parser().parse_args()
    ontologies = DATA_FILES if args.ontology == "all" else (args.ontology,)
    matches = [record for record in records(ontologies) if select(record, args.mode, args.query)]
    result = {
        "query": args.query,
        "mode": args.mode,
        "ontology_scope": args.ontology,
        "release": RELEASE,
        "match_count": len(matches),
        "matches": matches,
    }
    if args.format == "json":
        write_json(result, args.output)
    else:
        if args.output is not None:
            args.output.parent.mkdir(parents=True, exist_ok=True)
        write_tsv(matches, args.output)
    if args.output is not None:
        print(f"Wrote {len(matches)} GO record(s) to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
