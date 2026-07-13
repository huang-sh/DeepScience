#!/usr/bin/env python3
"""Look up or search RCSB PDB with bounded results."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request


def request_json(url: str, timeout: float, body: dict | None = None) -> object:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"Accept": "application/json", "Content-Type": "application/json", "User-Agent": "DeepScience/0.0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description="Query RCSB PDB by four-character ID or full-text search.")
    parser.add_argument("query")
    parser.add_argument("--limit", type=int, default=5, choices=range(1, 11), metavar="1-10")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()
    try:
        if re.fullmatch(r"[0-9][A-Za-z0-9]{3}", args.query.strip()):
            pdb_id = args.query.upper()
            entry = request_json(f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}", args.timeout)
            entity_ids = entry.get("rcsb_entry_container_identifiers", {}).get("polymer_entity_ids", []) if isinstance(entry, dict) else []
            entities = [request_json(f"https://data.rcsb.org/rest/v1/core/polymer_entity/{pdb_id}/{entity_id}", args.timeout) for entity_id in entity_ids[:5]]
            result = {"mode": "entry", "pdb_id": pdb_id, "entry": entry, "polymer_entities": entities}
        else:
            body = {"query": {"type": "terminal", "service": "full_text", "parameters": {"value": args.query}}, "return_type": "entry", "request_options": {"results_content_type": ["experimental"], "paginate": {"start": 0, "rows": args.limit}}}
            result = {"mode": "search", "query": args.query, "results": request_json("https://search.rcsb.org/rcsbsearch/v2/query", args.timeout, body)}
        json.dump(result, sys.stdout, indent=2)
        print()
        return 0
    except Exception as error:
        print(f"PDB request failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
