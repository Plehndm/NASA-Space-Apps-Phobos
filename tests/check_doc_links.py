#!/usr/bin/env python3
"""Check that relative links in the repo's Markdown files point at files that exist.

Covers [text](path) links and `docs/...`-style paths in backticks that name a file with an extension.
External links (http, mailto) and anchors are skipped; git-ignored build outputs are not checked.

    python3 tests/check_doc_links.py          # from the repo root; exit code 1 on broken links
"""
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
# Backticked repo paths like `docs/plan.md` or `app/README.md` (a slash and a file extension).
TICK = re.compile(r"`((?:[\w.-]+/)+[\w .()-]+\.(?:md|py|ts|tsx|js|mjs|json|ipynb|pdf|csv|yml|html))`")
# Paths that are created by builds or downloads and are git-ignored on purpose.
GENERATED = ("app/data/", "data/", "raw/", "out_tiles/", "dtm_src/", "processed_data/", "raw_data/", "outputs/",
             "node_modules/", "executed/", "telemetry/")
# Paths on other servers that docs cite as sources (the PDS localization table).
REMOTE = ("msl_places/",)


def markdown_files():
    out = subprocess.run(["git", "ls-files", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [ROOT / p for p in out.splitlines() if "node_modules" not in p]


def tracked_files():
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return out.splitlines()


def broken_links(files=None):
    """Broken links in the given Markdown files (default: every tracked .md file)."""
    bad = []
    tracked = tracked_files()
    for md in (files if files is not None else markdown_files()):
        md = Path(md)
        text = md.read_text(encoding="utf-8", errors="replace")
        # Skip fenced code blocks: commands and examples there are not links.
        text = re.sub(r"```.*?```", "", text, flags=re.S)
        targets = [(m.group(1), "link") for m in LINK.finditer(text)] + [(m.group(1), "path") for m in TICK.finditer(text)]
        for target, kind in targets:
            if re.match(r"^[a-z]+:", target) or target.startswith("#"):
                continue
            path = unquote(target.split("#")[0])
            if not path or any(g in path for g in GENERATED + REMOTE) or "<" in path or "*" in path:
                continue
            # Backticked paths may be relative to the file's folder or to its project folder.
            candidates = [md.parent / path, ROOT / path] + [p / path for p in md.parents if ROOT in p.parents or p == ROOT]
            if kind == "link":
                candidates = [md.parent / path, ROOT / path.lstrip("/")]
            # A path written relative to a project folder (notebooks/x.ipynb in MarsDataPipline/heatmap/).
            suffix = any(t == path or t.endswith("/" + path) for t in tracked) if kind == "path" else False
            if not suffix and not any(c.exists() for c in candidates):
                where = md.relative_to(ROOT) if ROOT in md.parents else md
                bad.append(f"{where}: {target}")
    return bad


if __name__ == "__main__":
    bad = broken_links()
    for b in bad:
        print("broken:", b)
    print(f"{len(bad)} broken link(s) in {len(markdown_files())} Markdown files")
    sys.exit(1 if bad else 0)
