#!/usr/bin/env python3
"""Look up an Ensembl gene, transcript, or stable identifier."""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Query Ensembl by symbol or stable ID.")
    parser.add_argument("query")
    parser.add_argument("--species", default="homo_sapiens")
    parser.add_argument("--expand", dest="expand", action="store_true", default=True)
    parser.add_argument("--no-expand", dest="expand", action="store_false")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()

    query = args.query.strip()
    if re.match(r"^ENS[A-Z0-9]+$", query, re.IGNORECASE):
        path = f"lookup/id/{urllib.parse.quote(query)}"
    else:
        path = f"lookup/symbol/{urllib.parse.quote(args.species)}/{urllib.parse.quote(query)}"
    params = urllib.parse.urlencode({"expand": int(args.expand)})
    request = urllib.request.Request(
        f"https://rest.ensembl.org/{path}?{params}",
        headers={"Accept": "application/json", "Content-Type": "application/json", "User-Agent": "DeepScience/0.0.1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            result = json.load(response)
    except Exception as error:
        print(f"Ensembl request failed: {error}", file=sys.stderr)
        return 1
    json.dump({"query": query, "species": args.species, "result": result}, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
