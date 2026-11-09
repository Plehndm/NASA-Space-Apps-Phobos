#!/usr/bin/env python3
"""
Download the panorama sources named in manifest.json into raw/, checked byte for byte.

    python fetch_raw.py                       # from mars_streetview/
    python fetch_raw.py manifest.json --dest raw --check   # only verify what is already there

For each pano with a "download" URL: a file already in raw/ with the right size and SHA-256 is kept;
anything else is downloaded to a temporary file, checked, and only then moved into place. Only
NASA's asset server is allowed as a source, and a file that doesn't match its checksum is never used.
Standard library only, so it runs before any virtual environment exists.
"""
import argparse
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ALLOWED_HOSTS = {"assets.science.nasa.gov"}
CHUNK = 1 << 20


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def is_ok(path, size, digest):
    return path.is_file() and path.stat().st_size == size and sha256(path) == digest


def check_entry(p):
    """The manifest fields fetch needs, validated; raises ValueError with the reason."""
    name = str(p.get("file", ""))
    if Path(name).name != name or name in ("", ".", ".."):
        raise ValueError("file must be a plain file name")
    url = str(p.get("download", ""))
    u = urlparse(url)
    if u.scheme != "https" or u.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"download must be https on {', '.join(sorted(ALLOWED_HOSTS))}")
    size, digest = p.get("bytes"), str(p.get("sha256", ""))
    if not isinstance(size, int) or size <= 0 or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        raise ValueError("bytes and sha256 are required")
    return name, url, size, digest


def fetch(url, dest, size, digest):
    """Download url to dest through a temporary file in the same folder; check before moving."""
    req = urllib.request.Request(url, headers={"User-Agent": "mars-streetview-fetch/1.0"})
    fd, tmp = tempfile.mkstemp(prefix=".part-", dir=dest.parent)
    try:
        got = 0
        with os.fdopen(fd, "wb") as out, urllib.request.urlopen(req, timeout=60) as resp:
            final = urlparse(resp.geturl())
            if final.scheme != "https" or final.hostname not in ALLOWED_HOSTS:
                raise ValueError(f"redirected off the allowed host to {final.hostname}")
            while True:
                block = resp.read(CHUNK)
                if not block:
                    break
                got += len(block)
                if got > size:
                    raise ValueError(f"larger than the expected {size} bytes")
                out.write(block)
        if got != size or sha256(tmp) != digest:
            raise ValueError("size or checksum does not match the manifest")
        os.chmod(tmp, 0o644)  # mkstemp makes it private; a source image is an ordinary file
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest", nargs="?", default="manifest.json")
    ap.add_argument("--dest", default="raw")
    ap.add_argument("--check", action="store_true", help="verify existing files only; download nothing")
    args = ap.parse_args(argv)

    man = json.loads(Path(args.manifest).read_text())
    dest = Path(args.dest)
    dest.mkdir(parents=True, exist_ok=True)
    failed = 0
    for p in man["panos"]:
        try:
            name, url, size, digest = check_entry(p)
        except ValueError as e:
            print(f"skip {p.get('id')}: {e}", file=sys.stderr)
            failed += 1
            continue
        target = dest / name
        if is_ok(target, size, digest):
            print(f"ok    {name}")
            continue
        if args.check:
            print(f"BAD   {name}: missing or does not match the manifest", file=sys.stderr)
            failed += 1
            continue
        print(f"fetch {name} ({size / 1e6:.1f} MB)")
        try:
            fetch(url, target, size, digest)
            print(f"ok    {name}")
        except Exception as e:  # network, size, checksum: report and carry on with the rest
            print(f"FAIL  {name}: {e}", file=sys.stderr)
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
