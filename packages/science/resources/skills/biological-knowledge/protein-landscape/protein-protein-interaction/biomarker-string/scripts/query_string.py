#!/usr/bin/env python3
"""Query a bounded STRING interaction network."""

import argparse
import json
import sys
import urllib.parse
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Query STRING interaction partners for one or more proteins.")
    parser.add_argument("identifiers", help="Comma-separated protein or gene identifiers")
    parser.add_argument("--species", type=int, default=9606)
    parser.add_argument("--limit", type=int, default=10, choices=range(1, 51), metavar="1-50")
    parser.add_argument("--score-threshold", type=int, default=400, choices=range(0, 1001), metavar="0-1000")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()
    params = urllib.parse.urlencode({"identifiers": args.identifiers.replace(",", "\r"), "species": args.species, "limit": args.limit, "required_score": args.score_threshold, "caller_identity": "DeepScience"})
    request = urllib.request.Request(f"https://string-db.org/api/json/interaction_partners?{params}", headers={"User-Agent": "DeepScience/0.0.1"})
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            interactions = json.load(response)
    except Exception as error:
        print(f"STRING request failed: {error}", file=sys.stderr)
        return 1
    json.dump({"identifiers": args.identifiers.split(","), "species": args.species, "count": len(interactions), "interactions": interactions}, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
