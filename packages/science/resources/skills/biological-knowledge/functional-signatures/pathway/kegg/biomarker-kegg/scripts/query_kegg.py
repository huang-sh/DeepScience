#!/usr/bin/env python3
"""Query KEGG with named response fields and optional workspace output."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SNAPSHOT = Path(__file__).resolve().parent.parent / "assets" / "KEGG" / "KEGG_2026.txt"
SNAPSHOT_MANIFEST = SNAPSHOT.with_name("manifest.json")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("operation", choices=("info", "find", "genes", "snapshot"))
    result.add_argument("query")
    result.add_argument("--organism", default="hsa")
    result.add_argument("--limit", type=int, default=25, choices=range(1, 101), metavar="1-100")
    result.add_argument("--match", choices=("exact", "contains"), default="exact")
    result.add_argument("--timeout", type=float, default=30.0)
    result.add_argument("--output", type=Path, help="write structured JSON into the session workspace")
    return result


def parse_remote(operation: str, text: str, requested: str, resolved: str, url: str) -> dict[str, Any]:
    common = {
        "schemaVersion": 1,
        "operation": operation,
        "requestedQuery": requested,
        "resolvedQuery": resolved,
        "endpoint": url,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
    }
    if operation == "info":
        return {**common, "record": text}

    parsed_rows: list[tuple[str, str]] = []
    for number, line in enumerate(text.splitlines(), start=1):
        fields = line.split("\t")
        if len(fields) != 2 or not fields[0] or not fields[1]:
            raise RuntimeError(f"Unexpected KEGG {operation} response schema on line {number}")
        parsed_rows.append((fields[0], fields[1]))

    if operation == "find":
        matches = [{"pathwayId": identifier, "description": description} for identifier, description in parsed_rows]
        return {
            **common,
            "count": len(matches),
            "matches": matches,
            "schema": {"matches": "array<{pathwayId: string, description: string}>"},
        }

    genes = [{"pathwayId": pathway_id, "geneId": gene_id} for pathway_id, gene_id in parsed_rows]
    return {
        **common,
        "organism": resolved[:3] if len(resolved) >= 3 else None,
        "count": len(genes),
        "genes": genes,
        "identifierNamespace": "KEGG organism-prefixed gene ID",
        "schema": {"genes": "array<{pathwayId: string, geneId: string}>"},
    }


def query_remote(args: argparse.Namespace) -> dict[str, Any]:
    requested = args.query.strip()
    resolved = requested
    if args.operation == "genes" and requested.startswith("map") and requested[3:].isdigit():
        resolved = f"{args.organism}{requested[3:]}"
    encoded = urllib.parse.quote(resolved, safe=":")
    if args.operation == "info":
        url = f"https://rest.kegg.jp/get/{encoded}"
    elif args.operation == "genes":
        organism = urllib.parse.quote(args.organism, safe="")
        url = f"https://rest.kegg.jp/link/{organism}/{encoded}"
    else:
        url = f"https://rest.kegg.jp/find/pathway/{encoded}"
    try:
        with urllib.request.urlopen(url, timeout=max(1.0, min(args.timeout, 120.0))) as response:
            text = response.read().decode("utf-8")
    except Exception as error:
        raise RuntimeError(f"KEGG request failed: {error}") from error
    if args.operation == "find":
        text = "\n".join(text.splitlines()[: args.limit])
        if text:
            text += "\n"
    return parse_remote(args.operation, text, requested, resolved, url)


def query_snapshot(args: argparse.Namespace) -> dict[str, Any]:
    if not SNAPSHOT.is_file() or not SNAPSHOT_MANIFEST.is_file():
        raise RuntimeError("Bundled KEGG snapshot or manifest is missing")
    manifest = json.loads(SNAPSHOT_MANIFEST.read_text(encoding="utf-8"))
    payload = SNAPSHOT.read_bytes()
    source_sha256 = hashlib.sha256(payload).hexdigest()
    checks = {
        "sourceSha256Matches": source_sha256 == manifest.get("sha256"),
        "sourceBytesMatch": len(payload) == manifest.get("bytes"),
        "organismPresent": bool(manifest.get("organism")),
        "taxonIdPresent": bool(manifest.get("taxonId")),
    }
    if not all(checks.values()):
        failed = ", ".join(name for name, passed in checks.items() if not passed)
        raise RuntimeError(f"KEGG snapshot validation failed: {failed}")
    query = args.query.strip().casefold()
    matches: list[dict[str, Any]] = []
    with SNAPSHOT.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 3:
                raise RuntimeError(f"Unexpected KEGG snapshot schema on line {line_number}")
            pathway_name = fields[0]
            selected = pathway_name.casefold() == query if args.match == "exact" else query in pathway_name.casefold()
            if not selected:
                continue
            genes = [value for value in fields[2:] if value]
            matches.append(
                {
                    "pathwayId": None,
                    "pathwayName": pathway_name,
                    "description": fields[1] or None,
                    "geneCount": len(genes),
                    "genes": genes,
                    "identifierNamespace": "gene symbol",
                    "sourceLine": line_number,
                }
            )
    return {
        "schemaVersion": 1,
        "operation": "snapshot",
        "query": args.query.strip(),
        "matchMode": args.match,
        "snapshot": manifest["release"],
        "organism": manifest["organism"],
        "taxonId": manifest["taxonId"],
        "source": {
            "path": str(SNAPSHOT),
            "bytes": len(payload),
            "sha256": source_sha256,
            "manifest": str(SNAPSHOT_MANIFEST),
        },
        "count": len(matches),
        "matches": matches,
        "schema": {
            "matches": "array<{pathwayId: null, pathwayName, description, geneCount, genes, identifierNamespace, sourceLine}>"
        },
        "validation": {"status": "passed", "checks": checks},
    }


def main() -> int:
    args = parser().parse_args()
    result = query_snapshot(args) if args.operation == "snapshot" else query_remote(args)
    rendered = f"{json.dumps(result, ensure_ascii=False, indent=2)}\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(
            json.dumps(
                {
                    "output": str(args.output),
                    "operation": result["operation"],
                    "count": result.get("count"),
                    "schemaVersion": result["schemaVersion"],
                },
                ensure_ascii=False,
            )
        )
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
