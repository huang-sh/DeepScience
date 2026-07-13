#!/usr/bin/env python3
"""Query bounded NCBI Gene summaries through E-utilities."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request


BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def get_json(endpoint: str, params: dict[str, object], timeout: float) -> dict:
    request = urllib.request.Request(f"{BASE}/{endpoint}?{urllib.parse.urlencode(params)}", headers={"User-Agent": "DeepScience/0.0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description="Query NCBI Gene by symbol, Gene ID, or search expression.")
    parser.add_argument("query")
    parser.add_argument("--organism", default="human")
    parser.add_argument("--limit", type=int, default=5, choices=range(1, 11), metavar="1-10")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()
    try:
        query = args.query.strip()
        if re.fullmatch(r"\d+", query):
            ids = [query]
        else:
            search = get_json("esearch.fcgi", {"db": "gene", "term": f"{query}[Gene] AND {args.organism}[Organism]", "retmode": "json", "retmax": args.limit}, args.timeout)
            ids = search.get("esearchresult", {}).get("idlist", [])
        summary = get_json("esummary.fcgi", {"db": "gene", "id": ",".join(ids), "retmode": "json"}, args.timeout) if ids else {"result": {}}
        records = [summary.get("result", {}).get(gene_id, {"uid": gene_id}) for gene_id in ids]
        json.dump({"query": query, "organism": args.organism, "count": len(records), "records": records}, sys.stdout, indent=2)
        print()
        return 0
    except Exception as error:
        print(f"NCBI Gene request failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
