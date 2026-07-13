#!/usr/bin/env python3
"""Search PubMed and return bounded citation and abstract metadata."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def fetch(url: str, timeout: float) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "DeepScience/0.0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def text(node: ET.Element | None, path: str) -> str:
    return "" if node is None else node.findtext(path, default="").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Search PubMed and return titles, authors, abstracts, and PMIDs.")
    parser.add_argument("query")
    parser.add_argument("--limit", type=int, default=5, choices=range(1, 21), metavar="1-20")
    parser.add_argument("--sort", choices=("relevance", "date"), default="relevance")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()
    try:
        params = urllib.parse.urlencode({"db": "pubmed", "term": args.query, "retmode": "json", "retmax": args.limit, "sort": "pub date" if args.sort == "date" else "relevance"})
        search = json.loads(fetch(f"{BASE}/esearch.fcgi?{params}", args.timeout))
        ids = search.get("esearchresult", {}).get("idlist", [])
        articles = []
        if ids:
            params = urllib.parse.urlencode({"db": "pubmed", "id": ",".join(ids), "retmode": "xml"})
            root = ET.fromstring(fetch(f"{BASE}/efetch.fcgi?{params}", args.timeout))
            for entry in root.findall(".//PubmedArticle"):
                citation = entry.find("MedlineCitation")
                article = entry.find(".//Article")
                authors = [] if article is None else [" ".join(filter(None, [author.findtext("ForeName"), author.findtext("LastName")])) for author in article.findall(".//Author")]
                abstracts = [] if article is None else ["".join(item.itertext()).strip() for item in article.findall(".//AbstractText")]
                articles.append({"pmid": text(citation, "PMID"), "title": "" if article is None else "".join(article.find("ArticleTitle").itertext()).strip() if article.find("ArticleTitle") is not None else "", "authors": authors, "abstract": "\n".join(abstracts)})
        json.dump({"query": args.query, "total": int(search.get("esearchresult", {}).get("count", 0)), "count": len(articles), "articles": articles}, sys.stdout, indent=2)
        print()
        return 0
    except Exception as error:
        print(f"PubMed request failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
