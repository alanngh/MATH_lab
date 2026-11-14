#!/usr/bin/env python3
"""Refresh the Math Lab catalog in index.html.

Scans the repository for simulation pages and rewrites the block between
``<!-- AUTO-CATALOG-START -->`` and ``<!-- AUTO-CATALOG-END -->``, grouping
pages by the folder they live in.

Metadata (all optional — sensible fallbacks are used):
  * ``<title>`` / ``<meta name="description">`` / ``<meta name="keywords">``
    inside each simulation page.
  * ``<page-name>.json`` next to a page, e.g. ``simulations/limits.json``:
        {"title": "...", "description": "...", "tags": ["Calculus", "..."]}
  * ``_collection.json`` inside a folder to name/describe that collection:
        {"title": "1226", "description": "Course demos...", "order": 1}

Directories whose name starts with ``.`` or ``_`` are ignored, as are
files whose name starts with ``_`` and the root ``index.html`` itself.

Usage:
    python3 update_index_links.py          # rewrite index.html
    python3 update_index_links.py --check  # exit 1 if index.html is stale
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import textwrap
from datetime import date
from html import escape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INDEX_FILE = ROOT / "index.html"

CATALOG_START = "<!-- AUTO-CATALOG-START -->"
CATALOG_END = "<!-- AUTO-CATALOG-END -->"
SIM_COUNT_START = "<!-- AUTO-SIM-COUNT -->"
SIM_COUNT_END = "<!-- /AUTO-SIM-COUNT -->"
COLLECTION_COUNT_START = "<!-- AUTO-COLLECTION-COUNT -->"
COLLECTION_COUNT_END = "<!-- /AUTO-COLLECTION-COUNT -->"
UPDATED_START = "<!-- AUTO-UPDATED -->"
UPDATED_END = "<!-- /AUTO-UPDATED -->"

ROOT_COLLECTION = {
    "title": "Standalone",
    "description": "Single-page experiments that live at the root of the lab.",
}
FALLBACK_DESCRIPTION = "An interactive mathematics simulation — open the page to explore."


# --------------------------------------------------------------------------
# Page metadata
# --------------------------------------------------------------------------
class PageHeadParser(HTMLParser):
    """Collect <title>, meta description and meta keywords from a page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.in_title = False
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            data = {key.lower(): (value or "") for key, value in attrs}
            name = data.get("name", "").lower()
            if name in {"description", "keywords"} and "content" in data:
                self.meta.setdefault(name, data["content"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def humanize(text: str) -> str:
    return " ".join(part for part in re.split(r"[-_\s]+", text) if part).title()


def read_sidecar(html_file: Path) -> dict:
    sidecar = html_file.with_suffix(".json")
    if not sidecar.is_file():
        return {}
    try:
        data = json.loads(sidecar.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def read_page(html_file: Path) -> tuple[str, str, list[str]]:
    """Return (title, description, tags) for a simulation page."""
    try:
        source = html_file.read_text(encoding="utf-8", errors="replace")
    except OSError:
        source = ""
    parser = PageHeadParser()
    try:
        parser.feed(source)
    except Exception:  # malformed HTML should never break the generator
        pass

    sidecar = read_sidecar(html_file)
    title = clean_text(str(sidecar.get("title") or ""))
    if not title:
        title = clean_text(" ".join(parser.title_parts))
    if not title:
        title = humanize(html_file.stem)

    description = clean_text(str(sidecar.get("description") or ""))
    if not description:
        description = clean_text(parser.meta.get("description", ""))

    raw_tags = sidecar.get("tags") or parser.meta.get("keywords", "")
    if isinstance(raw_tags, str):
        raw_tags = re.split(r"[,;]", raw_tags)
    tags = []
    for tag in raw_tags if isinstance(raw_tags, list) else []:
        value = clean_text(str(tag))
        if value and value.lower() not in {existing.lower() for existing in tags}:
            tags.append(value)

    return title, description, tags


# --------------------------------------------------------------------------
# Collections
# --------------------------------------------------------------------------
def visible_html_files() -> list[Path]:
    pages = []
    for path in ROOT.rglob("*.html"):
        relative = path.relative_to(ROOT)
        if path.resolve() == INDEX_FILE.resolve():
            continue
        if any(part.startswith(".") or part.startswith("_") for part in relative.parts[:-1]):
            continue
        if relative.name.startswith("_"):
            continue
        if relative.parts and relative.parts[0] in {"node_modules", "venv", ".venv"}:
            continue
        pages.append(path)
    return sorted(pages, key=lambda item: item.relative_to(ROOT).as_posix().lower())


def collection_key(html_file: Path) -> Path:
    """Directory that groups a page; ``.`` means the root collection."""
    return html_file.relative_to(ROOT).parent


def folder_metadata(folder: Path) -> dict:
    if folder == Path("."):
        return dict(ROOT_COLLECTION, order=-1)
    data: dict = {}
    sidecar = folder / "_collection.json"
    if sidecar.is_file():
        try:
            loaded = json.loads(sidecar.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                data = loaded
        except (OSError, json.JSONDecodeError):
            data = {}
    title = clean_text(str(data.get("title") or "")) or humanize(folder.name)
    description = clean_text(str(data.get("description") or ""))
    if not description:
        description = f"Simulations grouped in the {folder.name} folder."
    try:
        order = int(data.get("order", 0))
    except (TypeError, ValueError):
        order = 0
    return {"title": title, "description": description, "order": order}


def collection_anchor(folder: Path) -> str:
    return "." if folder == Path(".") else folder.as_posix()


# --------------------------------------------------------------------------
# Markup
# --------------------------------------------------------------------------
def card_html(html_file: Path, number: int) -> str:
    relative_url = html_file.relative_to(ROOT).as_posix()
    title, description, tags = read_page(html_file)
    description = description or FALLBACK_DESCRIPTION
    tag_markup = "".join(
        f'<span class="tag">{escape(tag)}</span>' for tag in tags
    )
    tag_row = (
        f'\n    <span class="sim-tags">{tag_markup}</span>' if tag_markup else ""
    )
    tag_data = escape("|".join(tags), quote=True)
    search_data = escape(
        clean_text(" ".join([title, description, *tags])).lower(), quote=True
    )
    return (
        f'<a class="sim-card" href="{escape(relative_url, quote=True)}"'
        f' data-tags="{tag_data}" data-search="{search_data}">\n'
        f'  <span class="sim-num">{number:02d}</span>\n'
        '  <div class="sim-body">\n'
        f'    <h4 class="sim-name">{escape(title)}</h4>\n'
        f'    <p class="sim-desc">{escape(description)}</p>{tag_row}\n'
        '  </div>\n'
        '  <span class="sim-open" aria-hidden="true">Open</span>\n'
        '</a>'
    )


def build_catalog(pages: list[Path]) -> tuple[str, int, int]:
    groups: dict[Path, list[Path]] = {}
    for page in pages:
        groups.setdefault(collection_key(page), []).append(page)

    def sort_key(folder: Path) -> tuple[int, str]:
        meta = folder_metadata(folder)
        return (meta["order"], meta["title"].lower())

    blocks = []
    number = 0
    for folder in sorted(groups, key=sort_key):
        meta = folder_metadata(folder)
        members = sorted(
            groups[folder], key=lambda item: read_page(item)[0].lower()
        )
        cards = []
        for page in members:
            number += 1
            cards.append(card_html(page, number))
        count = len(members)
        noun = "simulator" if count == 1 else "simulators"
        blocks.append(
            textwrap.dedent(
                f"""\
                <div class="collection" data-collection="{escape(collection_anchor(folder), quote=True)}">
                  <header class="collection-head">
                    <div class="collection-meta">
                      <span class="collection-kicker">Collection</span>
                      <h3 class="collection-title">{escape(meta["title"])}</h3>
                      <p class="collection-desc">{escape(meta["description"])}</p>
                    </div>
                    <span class="collection-count">{count} {noun}</span>
                  </header>
                  <div class="sim-grid">
                """
            )
            + "\n".join(textwrap.indent(card, "  ") for card in cards)
            + "\n  </div>\n</div>\n"
        )

    return "\n".join(block.rstrip() for block in blocks), number, len(groups)


# --------------------------------------------------------------------------
# File rewriting
# --------------------------------------------------------------------------
def replace_block(text: str, start: str, end: str, content: str) -> str:
    """Replace a marker-delimited block, preserving its indentation."""
    pattern = re.compile(
        rf"^(?P<indent>[ \t]*){re.escape(start)}.*?{re.escape(end)}",
        flags=re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        raise SystemExit(
            f"Missing markers in {INDEX_FILE.name}: {start} … {end}"
        )
    indent = match.group("indent")
    indented = "\n".join(indent + line if line else "" for line in content.splitlines())
    replacement = f"{indent}{start}\n{indented}\n{indent}{end}"
    return text[: match.start()] + replacement + text[match.end() :]


def replace_inline(text: str, start: str, end: str, value: str) -> str:
    pattern = re.compile(
        rf"{re.escape(start)}.*?{re.escape(end)}", flags=re.DOTALL
    )
    if not pattern.search(text):
        raise SystemExit(f"Missing markers in {INDEX_FILE.name}: {start} … {end}")
    return pattern.sub(f"{start}{value}{end}", text, count=1)


def render_index() -> tuple[str, int, int]:
    if not INDEX_FILE.is_file():
        raise SystemExit(f"Could not find {INDEX_FILE}")
    index_html = INDEX_FILE.read_text(encoding="utf-8")

    pages = visible_html_files()
    catalog, sim_count, collection_count = build_catalog(pages)

    updated = replace_block(index_html, CATALOG_START, CATALOG_END, catalog)
    updated = replace_inline(updated, SIM_COUNT_START, SIM_COUNT_END, str(sim_count))
    updated = replace_inline(
        updated, COLLECTION_COUNT_START, COLLECTION_COUNT_END, str(collection_count)
    )
    updated = replace_inline(updated, UPDATED_START, UPDATED_END, date.today().isoformat())
    return updated, sim_count, collection_count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--check",
        action="store_true",
        help="do not write; exit with status 1 if index.html is out of date",
    )
    args = parser.parse_args()

    updated, sim_count, collection_count = render_index()
    current = INDEX_FILE.read_text(encoding="utf-8")

    if args.check:
        if updated != current:
            print(f"{INDEX_FILE.name} is out of date — run: python3 {Path(__file__).name}")
            return 1
        print(f"{INDEX_FILE.name} is up to date ({sim_count} simulations, {collection_count} collections).")
        return 0

    if updated == current:
        print(f"{INDEX_FILE.name} is already up to date ({sim_count} simulations).")
        return 0

    INDEX_FILE.write_text(updated, encoding="utf-8")
    print(
        f"Updated {INDEX_FILE.name}: {sim_count} simulation(s) "
        f"across {collection_count} collection(s)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
