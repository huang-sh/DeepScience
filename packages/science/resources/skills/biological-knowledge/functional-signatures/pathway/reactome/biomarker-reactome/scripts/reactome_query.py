#!/usr/bin/env python3
"""Bounded command-line connector for the public Reactome REST services."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

CONTENT_SERVICE = "https://reactome.org/ContentService"
ANALYSIS_SERVICE = "https://reactome.org/AnalysisService"
MAX_RESPONSE_BYTES = 20 * 1024 * 1024
USER_AGENT = "DeepScience-Reactome-Resource/1.0"
GENE_SET_MEMBER = "ReactomePathways.gmt"
BUNDLED_GENE_SET_ARCHIVE = (
    Path(__file__).resolve().parent.parent / "assets" / "Reactome" / "ReactomePathways.gmt.zip"
)
BUNDLED_GENE_SET_GMT = BUNDLED_GENE_SET_ARCHIVE.with_name(GENE_SET_MEMBER)
BUNDLED_GENE_SET_MANIFEST = BUNDLED_GENE_SET_ARCHIVE.with_name("manifest.json")
SPECIES_STABLE_PREFIXES = {
    "Homo sapiens": "R-HSA-",
    "Mus musculus": "R-MMU-",
    "Rattus norvegicus": "R-RNO-",
    "Danio rerio": "R-DRE-",
    "Drosophila melanogaster": "R-DME-",
    "Caenorhabditis elegans": "R-CEL-",
    "Saccharomyces cerevisiae": "R-SCE-",
}


def request_data(url: str, *, body: bytes | None = None, timeout: float = 30.0) -> Any:
    headers = {"Accept": "*/*", "User-Agent": USER_AGENT}
    if body is not None:
        headers["Content-Type"] = "text/plain; charset=utf-8"
    request = Request(url, data=body, headers=headers, method="POST" if body is not None else "GET")
    try:
        with urlopen(request, timeout=timeout) as response:
            length = response.headers.get("Content-Length")
            if length and int(length) > MAX_RESPONSE_BYTES:
                raise RuntimeError("Reactome response exceeds the 20 MiB safety limit")
            payload = response.read(MAX_RESPONSE_BYTES + 1)
            if len(payload) > MAX_RESPONSE_BYTES:
                raise RuntimeError("Reactome response exceeds the 20 MiB safety limit")
    except HTTPError as error:
        detail = error.read(4096).decode("utf-8", errors="replace")
        raise RuntimeError(f"Reactome HTTP {error.code}: {detail or error.reason}") from error
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"Reactome request failed: {error}") from error
    text = payload.decode("utf-8", errors="strict")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text.strip()


def bounded(value: Any, limit: int) -> Any:
    if isinstance(value, list):
        return value[:limit]
    if isinstance(value, dict):
        result = dict(value)
        for key in ("results", "entries", "pathways"):
            if isinstance(result.get(key), list):
                result[key] = result[key][:limit]
        return result
    return value


def render_json(value: Any) -> str:
    return f"{json.dumps(value, ensure_ascii=False, indent=2)}\n"


def write_json(path: Path, value: Any) -> bytes:
    payload = render_json(value).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return payload


def sidecar_path(output: Path, kind: str) -> Path:
    base = output.with_suffix("") if output.suffix.lower() == ".json" else output
    return base.with_name(f"{base.name}.{kind}.json")


def binary_sidecar_path(output: Path, kind: str, suffix: str) -> Path:
    base = output.with_suffix("") if output.suffix.lower() == ".json" else output
    return base.with_name(f"{base.name}.{kind}.{suffix}")


def species_name(record: Any) -> str | None:
    if not isinstance(record, dict):
        return None
    direct = record.get("speciesName")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    species = record.get("species")
    if isinstance(species, list) and species:
        first = species[0]
        if isinstance(first, dict):
            display_name = first.get("displayName") or first.get("name")
            if isinstance(display_name, str) and display_name.strip():
                return display_name.strip()
    return None


def stable_id(record: Any) -> str | None:
    if not isinstance(record, dict):
        return None
    value = record.get("stId") or record.get("stableIdentifier")
    if isinstance(value, dict):
        value = value.get("identifier") or value.get("displayName")
    if isinstance(value, str) and value.strip():
        return value.strip().split(".", 1)[0]
    versioned = record.get("stIdVersion")
    if isinstance(versioned, str) and versioned.strip():
        return versioned.strip().split(".", 1)[0]
    return None


def participant_summary(records: Any) -> dict[str, Any]:
    if not isinstance(records, list):
        raise RuntimeError("Reactome participants response must be a JSON list")
    physical_ids: set[str] = set()
    physical_classes: Counter[str] = Counter()
    references: dict[str, dict[str, dict[str, Any]]] = {}
    for entity in records:
        if not isinstance(entity, dict):
            raise RuntimeError("Reactome participants response contains a non-object entry")
        physical_id = entity.get("peDbId")
        if physical_id is not None:
            physical_ids.add(str(physical_id))
        physical_classes[str(entity.get("schemaClass") or "Unknown")] += 1
        for reference in entity.get("refEntities") or []:
            if not isinstance(reference, dict):
                continue
            schema_class = str(reference.get("schemaClass") or "Unknown")
            identifier = reference.get("identifier")
            if not isinstance(identifier, str) or not identifier.strip():
                continue
            references.setdefault(schema_class, {})[identifier] = {
                "identifier": identifier,
                "stId": reference.get("stId"),
                "schemaClass": schema_class,
                "displayName": reference.get("displayName"),
            }

    protein_types = ("ReferenceGeneProduct", "ReferenceIsoform")
    native_proteins = sorted(
        {identifier for kind in protein_types for identifier in references.get(kind, {})}
    )
    base_uniprot = sorted({re.sub(r"-\d+$", "", identifier) for identifier in native_proteins})
    return {
        "schemaVersion": 1,
        "physicalEntities": {
            "uniqueCount": len(physical_ids),
            "responseRowCount": len(records),
            "bySchemaClass": dict(sorted(physical_classes.items())),
        },
        "referenceEntities": {
            "bySchemaClass": {
                kind: list(entries.values()) for kind, entries in sorted(references.items())
            },
            "nativeProteinAccessions": native_proteins,
            "nativeProteinAccessionCount": len(native_proteins),
            "baseUniProtAccessions": base_uniprot,
            "baseUniProtAccessionCount": len(base_uniprot),
            "smallMoleculeIdentifiers": sorted(references.get("ReferenceMolecule", {})),
            "therapeuticIdentifiers": sorted(references.get("ReferenceTherapeutic", {})),
        },
        "countingContract": {
            "physicalEntities": "unique top-level peDbId",
            "nativeProteinAccessions": "unique ReferenceGeneProduct and ReferenceIsoform identifier",
            "baseUniProtAccessions": "native protein accessions with a terminal numeric isoform suffix removed",
            "geneSymbols": "not emitted; requires a validated UniProt-to-gene mapping",
        },
    }


def write_participants_bundle(
    args: argparse.Namespace,
    participants_url: str,
    participants: Any,
    query_response: Any,
    version_response: Any,
) -> dict[str, Any]:
    output = args.output
    if output is None:
        raise RuntimeError("participants bundle requires --output")
    verified_stable_id = stable_id(query_response)
    verified_species = species_name(query_response)
    version = str(version_response).strip() if version_response is not None else ""
    checks = {
        "participantsIsList": isinstance(participants, list),
        "stableIdMatches": verified_stable_id == args.identifier,
        "speciesPresent": bool(verified_species),
        "versionPresent": bool(version),
    }
    if not all(checks.values()):
        failed = ", ".join(name for name, passed in checks.items() if not passed)
        raise RuntimeError(f"Reactome participants provenance validation failed: {failed}")

    summary = participant_summary(participants)
    raw_payload = write_json(output, participants)
    summary_output = args.summary_output or sidecar_path(output, "summary")
    provenance_output = args.provenance_output or sidecar_path(output, "provenance")
    retrieved_at = datetime.now(timezone.utc).isoformat()
    write_json(summary_output, summary)
    provenance = {
        "schemaVersion": 1,
        "database": "Reactome",
        "action": "participants",
        "endpoint": participants_url,
        "stableId": verified_stable_id,
        "species": verified_species,
        "reactomeVersion": version,
        "retrievedAt": retrieved_at,
        "parameters": {"identifier": args.identifier, "timeoutSeconds": args.timeout},
        "rawResponse": {
            "path": str(output),
            "bytes": len(raw_payload),
            "sha256": hashlib.sha256(raw_payload).hexdigest(),
        },
        "derivedSummary": {"path": str(summary_output)},
        "verificationResponses": {"query": query_response, "version": version_response},
        "validation": {"status": "passed", "checks": checks},
    }
    write_json(provenance_output, provenance)
    return {
        "raw": str(output),
        "summary": str(summary_output),
        "provenance": str(provenance_output),
        "validation": "passed",
    }


def parse_gene_set_text(text: str, identifier: str) -> tuple[str, list[str]]:
    matches: list[tuple[str, list[str]]] = []
    for number, line in enumerate(text.splitlines(), start=1):
        fields = line.split("\t")
        if len(fields) < 3:
            raise RuntimeError(f"Unexpected Reactome GMT schema on line {number}")
        if fields[1] == identifier:
            matches.append((fields[0], [gene for gene in fields[2:] if gene]))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one Reactome GMT row for {identifier}, found {len(matches)}")
    pathway_name, genes = matches[0]
    if not genes:
        raise RuntimeError(f"Reactome GMT row for {identifier} has no gene symbols")
    if len(genes) != len(set(genes)):
        raise RuntimeError(f"Reactome GMT row for {identifier} contains duplicate gene symbols")
    return pathway_name, genes


def find_gene_sets(args: argparse.Namespace) -> dict[str, Any]:
    if not BUNDLED_GENE_SET_GMT.is_file() or not BUNDLED_GENE_SET_MANIFEST.is_file():
        raise RuntimeError("Extracted Reactome gene-set snapshot or manifest is missing")
    manifest = json.loads(BUNDLED_GENE_SET_MANIFEST.read_text(encoding="utf-8"))
    source_payload = BUNDLED_GENE_SET_GMT.read_bytes()
    extracted = manifest.get("extracted") or {}
    if hashlib.sha256(source_payload).hexdigest() != extracted.get("sha256"):
        raise RuntimeError("Bundled Reactome GMT SHA-256 does not match its manifest")
    try:
        text = source_payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RuntimeError(f"Invalid Reactome GMT encoding: {error}") from error
    term = args.term.strip().casefold()
    expected_prefix = SPECIES_STABLE_PREFIXES.get(args.species.strip())
    matches: list[dict[str, Any]] = []
    for number, line in enumerate(text.splitlines(), start=1):
        fields = line.split("\t")
        if len(fields) < 3:
            raise RuntimeError(f"Unexpected Reactome GMT schema on line {number}")
        pathway_name, identifier = fields[0], fields[1]
        if term not in pathway_name.casefold():
            continue
        if expected_prefix and not identifier.startswith(expected_prefix):
            continue
        genes = [gene for gene in fields[2:] if gene]
        matches.append(
            {
                "pathwayName": pathway_name,
                "stableId": identifier,
                "geneCount": len(genes),
                "identifierNamespace": "gene symbol",
                "sourceLine": number,
            }
        )
        if len(matches) >= args.limit:
            break
    return {
        "schemaVersion": 1,
        "database": "Reactome",
        "operation": "gene-set-find",
        "query": args.term.strip(),
        "species": args.species.strip(),
        "reactomeVersion": str(manifest.get("reactomeVersion")),
        "accessMode": "local bundled snapshot",
        "count": len(matches),
        "matches": matches,
        "source": {
            "path": str(BUNDLED_GENE_SET_GMT),
            "sha256": extracted.get("sha256"),
            "downloadedAt": manifest.get("downloadedAt"),
        },
    }


def write_gene_set_bundle(args: argparse.Namespace) -> dict[str, Any]:
    output = args.output
    if output is None:
        raise RuntimeError("gene-set requires --output so its source and provenance can be audited")
    identifier = args.identifier.strip()
    if not BUNDLED_GENE_SET_GMT.is_file() or not BUNDLED_GENE_SET_MANIFEST.is_file():
        raise RuntimeError("Extracted Reactome gene-set snapshot or manifest is missing")
    manifest = json.loads(BUNDLED_GENE_SET_MANIFEST.read_text(encoding="utf-8"))
    source_payload = BUNDLED_GENE_SET_GMT.read_bytes()
    try:
        source_text = source_payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RuntimeError(f"Invalid Reactome GMT encoding: {error}") from error
    pathway_name, genes = parse_gene_set_text(source_text, identifier)

    source_sha256 = hashlib.sha256(source_payload).hexdigest()
    extracted = manifest.get("extracted") or {}
    verified_species = args.species.strip()
    version = str(manifest.get("reactomeVersion") or "").strip()
    expected_prefix = SPECIES_STABLE_PREFIXES.get(verified_species)
    checks = {
        "sourceSha256Matches": source_sha256 == extracted.get("sha256"),
        "sourceBytesMatch": len(source_payload) == extracted.get("bytes"),
        "stableIdPresent": bool(identifier),
        "speciesDeclared": bool(verified_species),
        "stableIdMatchesSpecies": expected_prefix is None or identifier.startswith(expected_prefix),
        "versionPresent": bool(version),
        "exactGmtRow": bool(pathway_name),
        "geneSymbolsPresent": bool(genes),
        "geneSymbolsUnique": len(genes) == len(set(genes)),
    }
    if not all(checks.values()):
        failed = ", ".join(name for name, passed in checks.items() if not passed)
        raise RuntimeError(f"Reactome gene-set provenance validation failed: {failed}")

    source_output = args.source_output or binary_sidecar_path(output, "source", "gmt")
    provenance_output = args.provenance_output or sidecar_path(output, "provenance")
    source_output.parent.mkdir(parents=True, exist_ok=True)
    source_output.write_bytes(source_payload)
    result = {
        "schemaVersion": 1,
        "database": "Reactome",
        "operation": "gene-set",
        "stableId": identifier,
        "pathwayName": pathway_name,
        "species": verified_species,
        "reactomeVersion": version,
        "scope": "ReactomePathways.gmt exported pathway membership",
        "accessMode": "local bundled snapshot",
        "identifierNamespace": "gene symbol",
        "geneCount": len(genes),
        "genes": genes,
        "source": {
            "url": manifest["sourceUrl"],
            "archiveMember": manifest["sourceArchive"]["member"],
            "downloadedAt": manifest["downloadedAt"],
        },
    }
    result_payload = write_json(output, result)
    retrieved_at = datetime.now(timezone.utc).isoformat()
    provenance = {
        "schemaVersion": 1,
        "database": "Reactome",
        "action": "gene-set",
        "stableId": identifier,
        "species": verified_species,
        "reactomeVersion": version,
        "accessedAt": retrieved_at,
        "snapshotDownloadedAt": manifest["downloadedAt"],
        "parameters": {"identifier": identifier, "species": verified_species},
        "geneSet": {
            "path": str(output),
            "bytes": len(result_payload),
            "sha256": hashlib.sha256(result_payload).hexdigest(),
            "geneCount": len(genes),
            "identifierNamespace": "gene symbol",
        },
        "rawSource": {
            "url": manifest["sourceUrl"],
            "path": str(source_output),
            "format": "GMT",
            "archiveMember": GENE_SET_MEMBER,
            "bytes": len(source_payload),
            "sha256": source_sha256,
        },
        "snapshotManifest": manifest,
        "validation": {"status": "passed", "checks": checks},
    }
    write_json(provenance_output, provenance)
    return {
        "geneSet": str(output),
        "source": str(source_output),
        "provenance": str(provenance_output),
        "geneCount": len(genes),
        "validation": "passed",
    }


def build_request(args: argparse.Namespace) -> tuple[str, bytes | None]:
    if args.action == "version":
        return f"{CONTENT_SERVICE}/data/database/version", None
    if args.action == "query":
        return f"{CONTENT_SERVICE}/data/query/{quote(args.identifier, safe=':-_')}", None
    if args.action == "participants":
        identifier = quote(args.identifier, safe=":-_")
        return f"{CONTENT_SERVICE}/data/participants/{identifier}", None
    if args.action == "search":
        parameters = urlencode(
            {"query": args.term, "species": args.species, "types": args.types, "cluster": "true"}
        )
        return f"{CONTENT_SERVICE}/search/query?{parameters}", None
    parameters = urlencode(
        {
            "pageSize": args.limit,
            "page": 1,
            "sortBy": "ENTITIES_FDR",
            "order": "ASC",
            "resource": "TOTAL",
            "pValue": 1,
            "includeDisease": str(args.include_disease).lower(),
        }
    )
    return f"{ANALYSIS_SERVICE}/identifiers/?{parameters}", "\n".join(args.identifiers).encode("utf-8")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    subparsers = root.add_subparsers(dest="action", required=True)

    def command(name: str, help_text: str) -> argparse.ArgumentParser:
        result = subparsers.add_parser(name, help=help_text)
        result.add_argument("--timeout", type=float, default=30.0, help="request timeout in seconds")
        result.add_argument("--output", type=Path, help="write JSON into the session workspace")
        result.add_argument("--dry-run", action="store_true", help="print request details without contacting Reactome")
        return result

    command("version", "get the current Reactome database version")
    query = command("query", "query one stable ID or supported identifier")
    query.add_argument("identifier")
    gene_set = command("gene-set", "retrieve the official pathway gene-symbol set for one stable ID")
    gene_set.add_argument("identifier")
    gene_set.add_argument("--species", default="Homo sapiens")
    gene_set.add_argument("--source-output", type=Path, help="override the downloaded GMT archive path")
    gene_set.add_argument("--provenance-output", type=Path, help="override the provenance path")
    gene_set_find = command("gene-set-find", "search the bundled pathway gene-set snapshot")
    gene_set_find.add_argument("term")
    gene_set_find.add_argument("--species", default="Homo sapiens")
    gene_set_find.add_argument("--limit", type=int, default=20)
    participants = command("participants", "list physical entities participating in an event")
    participants.add_argument("identifier")
    participants.add_argument("--summary-output", type=Path, help="override the derived summary path")
    participants.add_argument("--provenance-output", type=Path, help="override the provenance path")
    search = command("search", "search Reactome records")
    search.add_argument("term")
    search.add_argument("--species", default="Homo sapiens")
    search.add_argument("--types", default="Pathway")
    search.add_argument("--limit", type=int, default=20)
    enrich = command("enrich", "run pathway over-representation analysis")
    enrich.add_argument("identifiers", nargs="+")
    enrich.add_argument("--limit", type=int, default=20)
    enrich.add_argument("--include-disease", action="store_true")
    return root


def main() -> int:
    args = parser().parse_args()
    limit = max(1, min(getattr(args, "limit", 20), 1000))
    if hasattr(args, "limit"):
        args.limit = limit
    if args.action in {"gene-set", "gene-set-find"}:
        if args.dry_run:
            print(
                render_json(
                    {
                        "method": "LOCAL_READ",
                        "path": str(BUNDLED_GENE_SET_GMT),
                        "manifest": str(BUNDLED_GENE_SET_MANIFEST),
                        "query": getattr(args, "identifier", None) or getattr(args, "term", None),
                        "species": args.species,
                    }
                ),
                end="",
            )
            return 0
        if args.action == "gene-set":
            print(render_json(write_gene_set_bundle(args)), end="")
            return 0
        result = find_gene_sets(args)
        if args.output:
            write_json(args.output, result)
            print(render_json({"output": str(args.output), "count": result["count"]}), end="")
        else:
            print(render_json(result), end="")
        return 0
    url, body = build_request(args)
    if args.dry_run:
        result: Any = {"method": "POST" if body is not None else "GET", "url": url}
        if body is not None:
            result["identifierCount"] = len(args.identifiers)
    else:
        result = request_data(url, body=body, timeout=max(1.0, min(args.timeout, 120.0)))
        if args.action in {"search", "enrich"}:
            result = bounded(result, limit)
    if not args.dry_run and args.action == "participants" and args.output:
        query_url = f"{CONTENT_SERVICE}/data/query/{quote(args.identifier, safe=':-_')}"
        version_url = f"{CONTENT_SERVICE}/data/database/version"
        query_response = request_data(query_url, timeout=max(1.0, min(args.timeout, 120.0)))
        version_response = request_data(version_url, timeout=max(1.0, min(args.timeout, 120.0)))
        print(render_json(write_participants_bundle(args, url, result, query_response, version_response)), end="")
        return 0
    rendered = render_json(result)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(args.output)
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
