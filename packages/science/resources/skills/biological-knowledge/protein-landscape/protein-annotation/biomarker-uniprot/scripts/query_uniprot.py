#!/usr/bin/env python3
"""Bounded UniProtKB search using the public REST API."""

import argparse
import json
import sys
import urllib.parse
import urllib.request


FIELDS = "accession,gene_names,protein_name,organism_name,cc_function,go_p,go_c,go_f,ft_domain,cc_pathway,length"


def main() -> int:
    parser = argparse.ArgumentParser(description="Search UniProtKB by gene, accession, or query expression.")
    parser.add_argument("query")
    parser.add_argument("--organism", default="9606", help="NCBI taxonomy ID; use '*' for all organisms")
    parser.add_argument("--limit", type=int, default=5, choices=range(1, 26), metavar="1-25")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()

    query = args.query.strip()
    if args.organism != "*":
        query = f"({query}) AND organism_id:{args.organism}"
    params = urllib.parse.urlencode({"query": query, "fields": FIELDS, "format": "json", "size": args.limit})
    request = urllib.request.Request(
        f"https://rest.uniprot.org/uniprotkb/search?{params}",
        headers={"Accept": "application/json", "User-Agent": "DeepScience/0.0.1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            payload = json.load(response)
    except Exception as error:
        print(f"UniProt request failed: {error}", file=sys.stderr)
        return 1
    json.dump({"query": args.query, "organism": args.organism, "count": len(payload.get("results", [])), "results": payload.get("results", [])}, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
