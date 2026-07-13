#!/usr/bin/env python3
"""Browse and load scientific resource packages behind one router Skill."""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
from pathlib import Path
from typing import Any, Iterable

RESOURCE_ROOT_VALUE = os.environ.get("DEEPSCIENCE_RESOURCE_ROOT")
if not RESOURCE_ROOT_VALUE:
    raise RuntimeError("DEEPSCIENCE_RESOURCE_ROOT must identify the active Resource Skill")
RESOURCE_ROOT = Path(RESOURCE_ROOT_VALUE).resolve()
PROJECT_ROOT = RESOURCE_ROOT.parents[4]
COLLECTION = RESOURCE_ROOT.name
PACKAGE_DOCUMENT = "RESOURCE.md"


def scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        try:
            return str(ast.literal_eval(value))
        except (SyntaxError, ValueError):
            return value[1:-1]
    return value


def parse_document(path: Path) -> tuple[dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"Missing YAML frontmatter: {path}")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError(f"Unterminated YAML frontmatter: {path}")
    header = text[4:end]
    body = text[end + 5 :].lstrip()
    metadata: dict[str, str] = {}
    result: dict[str, Any] = {"metadata": metadata}
    in_metadata = False
    for line in header.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line == "metadata:":
            in_metadata = True
            continue
        if line.startswith("  ") and in_metadata and ":" in line:
            key, value = line.strip().split(":", 1)
            metadata[key] = scalar(value)
            continue
        in_metadata = False
        if not line.startswith(" ") and ":" in line:
            key, value = line.split(":", 1)
            result[key] = scalar(value)
    return result, body


def packages() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for document in sorted(RESOURCE_ROOT.rglob(PACKAGE_DOCUMENT)):
        frontmatter, body = parse_document(document)
        name = str(frontmatter.get("name", "")).strip()
        description = str(frontmatter.get("description", "")).strip()
        package_root = document.parent
        relative_parent = package_root.relative_to(RESOURCE_ROOT).parts[:-1]
        inferred_category = "/".join((COLLECTION, *relative_parent))
        category = str(frontmatter.get("category", inferred_category)).strip().strip("/")
        if not name or not description or not category:
            raise ValueError(f"Package requires name, description, and a resolvable category: {document}")
        entries.append(
            {
                "name": name,
                "description": description,
                "category": category,
                "access_mode": frontmatter["metadata"].get("access-mode", "local"),
                "database": frontmatter["metadata"].get(
                    "database", name[len("biomarker-") :] if name.startswith("biomarker-") else name
                ),
                "package_root": str(package_root),
                "project_path": f"project/{package_root.relative_to(PROJECT_ROOT).as_posix()}",
                "instruction_file": str(document),
                "body": body,
            }
        )
    return entries


def public(entry: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in entry.items() if key != "body"}


def category_segments(value: str) -> tuple[str, ...]:
    return tuple(segment for segment in value.strip().strip("/").split("/") if segment)


def browse(entries: list[dict[str, Any]], category: str) -> dict[str, Any]:
    parent = category_segments(category)
    matching = [entry for entry in entries if category_segments(entry["category"])[: len(parent)] == parent]
    if not matching:
        return {"kind": "empty", "category": "/".join(parent), "resource_count": 0}

    children: dict[str, list[dict[str, Any]]] = {}
    for entry in matching:
        segments = category_segments(entry["category"])
        if len(segments) > len(parent):
            children.setdefault(segments[len(parent)], []).append(entry)
    if children:
        rows = []
        for child, members in sorted(children.items()):
            child_path = "/".join((*parent, child))
            leaf = all(len(category_segments(member["category"])) == len(parent) + 1 for member in members)
            rows.append(
                {
                    "category": child_path,
                    "resource_count": len(members),
                    "exact_names": sorted(member["name"] for member in members) if leaf else [],
                }
            )
        return {
            "kind": "categories",
            "category": "/".join(parent),
            "resource_count": len(matching),
            "children": rows,
            "next_action": "Browse one exact child category; exact_names may be passed to show or instructions.",
        }

    return {
        "kind": "resource_metadata",
        "category": "/".join(parent),
        "resource_count": len(matching),
        "resources": [public(entry) for entry in matching],
        "next_action": "Compare scope and access mode, then load selected packages with instructions <exact-name>.",
    }


def by_name(entries: Iterable[dict[str, Any]], name: str) -> dict[str, Any]:
    normalized = name.casefold().strip()
    matches = [entry for entry in entries if entry["name"].casefold() == normalized]
    if len(matches) != 1:
        raise KeyError(name)
    return matches[0]


def validate(entries: list[dict[str, Any]]) -> dict[str, Any]:
    names: dict[str, int] = {}
    errors: list[str] = []
    for entry in entries:
        names[entry["name"]] = names.get(entry["name"], 0) + 1
        package_root = Path(entry["package_root"])
        if not package_root.is_dir():
            errors.append(f"Missing package root: {package_root}")
        if category_segments(entry["category"])[:1] != (COLLECTION,):
            errors.append(
                f"Package category must start with {COLLECTION}: {entry['name']} -> {entry['category']}"
            )
    errors.extend(f"Duplicate package name: {name}" for name, count in names.items() if count > 1)
    return {
        "ok": not errors,
        "resource_count": len(entries),
        "access_modes": {
            mode: sum(1 for entry in entries if entry["access_mode"] == mode)
            for mode in sorted({entry["access_mode"] for entry in entries})
        },
        "errors": errors,
    }


def package_files(entry: dict[str, Any], section: str) -> dict[str, Any]:
    package_root = Path(entry["package_root"])
    roots = [package_root / section] if section != "all" else [package_root / name for name in ("scripts", "references", "assets")]
    files = []
    for root in roots:
        if not root.is_dir():
            continue
        for path in sorted(candidate for candidate in root.rglob("*") if candidate.is_file()):
            files.append(
                {
                    "path": path.relative_to(package_root).as_posix(),
                    "size_bytes": path.stat().st_size,
                    "absolute_path": str(path),
                    "project_path": f"project/{path.relative_to(PROJECT_ROOT).as_posix()}",
                }
            )
    return {"name": entry["name"], "section": section, "file_count": len(files), "files": files}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Browse scientific resource packages.")
    subcommands = parser.add_subparsers(dest="command", required=True)
    browse_parser = subcommands.add_parser("browse", help="Browse hierarchical database categories")
    browse_parser.add_argument("category", nargs="?", default=COLLECTION)
    for command in ("show", "instructions"):
        subparser = subcommands.add_parser(command)
        subparser.add_argument("name")
    files_parser = subcommands.add_parser("files", help="List an exact package inventory")
    files_parser.add_argument("name")
    files_parser.add_argument("--section", choices=("all", "scripts", "references", "assets"), default="all")
    subcommands.add_parser("validate", help="Validate package metadata and names")
    return parser.parse_args()


def main() -> int:
    args = arguments()
    try:
        entries = packages()
        if args.command == "browse":
            print(json.dumps(browse(entries, args.category), ensure_ascii=False, indent=2))
        elif args.command == "show":
            print(json.dumps(public(by_name(entries, args.name)), ensure_ascii=False, indent=2))
        elif args.command == "instructions":
            entry = by_name(entries, args.name)
            print(
                f'<resource-package name="{entry["name"]}" access-mode="{entry["access_mode"]}" '
                f'category="{entry["category"]}" root="{entry["package_root"]}" '
                f'project-path="{entry["project_path"]}">'
            )
            print(
                "Path contract: use this package root for <resource-dir> and bash scripts; use the project-path "
                "prefix with read, grep, or ls. Use catalog.py files for package inventory."
            )
            body = entry["body"].replace("<resource-dir>", entry["package_root"])
            body = body.replace(
                "python3 packages/science/resources/skills/",
                f"python3 {PROJECT_ROOT}/packages/science/resources/skills/",
            )
            print(body.rstrip())
            print("</resource-package>")
        elif args.command == "files":
            print(json.dumps(package_files(by_name(entries, args.name), args.section), ensure_ascii=False, indent=2))
        else:
            result = validate(entries)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 1
        return 0
    except (OSError, ValueError, KeyError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
