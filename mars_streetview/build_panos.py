#!/usr/bin/env python3
"""
Mars Street View builder.

Turns NASA rover panoramas (full 360 or partial, equirectangular or
cylindrical-perspective) into Google Maps Street View custom-panorama tiles.

  python build_panos.py manifest.json --src raw/ --out public/panos

For each pano in the manifest:
  1. Reproject the source image onto a full 2:1 equirectangular sphere,
     placed at the right heading and pitch. Missing sky/ground (and the
     unseen arc of partial panoramas) is filled with a neutral Mars gradient.
  2. Cut a Google-style tile pyramid: zoom z has 2^z x 2^z tiles of
     tile_size x tile_size/2 (zoom 0 = one tile holding the whole sphere).
  3. Write panos.json (pano metadata + auto-computed links between nearby
     waypoints) for streetview.js to consume.

Credit for all imagery: NASA/JPL-Caltech/MSSS (and USGS for orbital data).
"""
import argparse, json, math, re, sys
from pathlib import Path

import numpy as np
from PIL import Image

# NASA TIFFs are huge (the largest here is ~60 Mpx), but keep a ceiling against decompression bombs.
Image.MAX_IMAGE_PIXELS = 1_000_000_000

SKY = np.array([196, 160, 128], np.float32)     # Martian daytime sky
HORIZON = np.array([176, 128, 92], np.float32)
GROUND = np.array([120, 82, 58], np.float32)    # regolith


def mars_background(w, h):
    """Equirect background: sky at top, ground at bottom, soft horizon."""
    el = np.linspace(90, -90, h, dtype=np.float32)[:, None]   # degrees
    t_sky = np.clip(el / 60.0, 0, 1)[..., None]
    t_gnd = np.clip(-el / 30.0, 0, 1)[..., None]
    col = HORIZON * (1 - t_sky) + SKY * t_sky
    col = col * (1 - t_gnd) + GROUND * t_gnd
    return np.broadcast_to(col, (h, w, 3)).copy()


def to_equirect(src, *, hfov, vfov, heading, pitch, projection, out_w):
    """Reproject src into an out_w x out_w/2 equirect canvas.

    heading: compass azimuth (deg, 0 = north, clockwise) of the source's
             horizontal centre.  pitch: elevation (deg) of its vertical centre.
    projection: 'equirect' (linear in elevation) or 'cylindrical'
                (tan of elevation, as in many NASA 'cylindrical' mosaics).
    """
    out_h = out_w // 2
    a = np.asarray(src.convert("RGB"), np.float32)
    sh, sw = a.shape[:2]

    # Angle at the centre of every output pixel
    az = (np.arange(out_w) + 0.5) / out_w * 360.0           # 0..360 from north
    el = 90.0 - (np.arange(out_h) + 0.5) / out_h * 180.0    # +90..-90

    # Horizontal: offset from pano centre, wrapped to [-180, 180)
    daz = (az - heading + 180.0) % 360.0 - 180.0
    u = daz / hfov * sw + sw / 2.0
    hvalid = np.abs(daz) <= hfov / 2.0 if hfov < 360 else np.ones_like(daz, bool)

    # Vertical
    if projection == "cylindrical":
        f = (sh / 2.0) / math.tan(math.radians(vfov / 2.0))
        top = math.tan(math.radians(pitch))
        v = sh / 2.0 - f * (np.tan(np.radians(np.clip(el, -89, 89))) - top)
    else:
        v = sh / 2.0 - (el - pitch) / vfov * sh
    vvalid = (v >= 0) & (v < sh)

    U, V = np.meshgrid(u, v)
    mask = hvalid[None, :] & vvalid[:, None]

    # Bilinear sample
    x0 = np.clip(np.floor(U - 0.5).astype(int), 0, sw - 1); x1 = np.clip(x0 + 1, 0, sw - 1)
    y0 = np.clip(np.floor(V - 0.5).astype(int), 0, sh - 1); y1 = np.clip(y0 + 1, 0, sh - 1)
    if hfov >= 360:  # wrap seam on full panoramas
        x1 = np.where(x0 == sw - 1, 0, x1)
    fx = np.clip(U - 0.5 - x0, 0, 1)[..., None]; fy = np.clip(V - 0.5 - y0, 0, 1)[..., None]
    samp = (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x1] * fx * (1 - fy)
            + a[y1, x0] * (1 - fx) * fy + a[y1, x1] * fx * fy)

    out = mars_background(out_w, out_h)
    # Feather the edges of the real imagery into the background
    feather = max(4, out_w // 400)
    m = mask.astype(np.float32)
    for _ in range(feather):  # cheap box-blur erosion of the mask
        m = np.minimum(m, (np.roll(m, 1, 0) + np.roll(m, -1, 0) + np.roll(m, 1, 1) + np.roll(m, -1, 1) + m) / 5 + 0.0)
    m = m[..., None]
    out = samp * m + out * (1 - m)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def cut_tiles(eq, out_dir, pano_id, tile):
    """Google custom Street View tile pyramid. Returns max zoom."""
    W = eq.width
    max_zoom = max(0, int(round(math.log2(W / tile))))
    for z in range(max_zoom + 1):
        nx = 2 ** z
        level = eq.resize((tile * nx, tile * nx // 2), Image.LANCZOS)
        th = tile // 2  # tiles are tile x tile/2, so the grid is nx x nx
        for ty in range(nx):
            for tx in range(nx):
                t = level.crop((tx * tile, ty * th, (tx + 1) * tile, (ty + 1) * th))
                p = out_dir / pano_id / f"{z}_{tx}_{ty}.jpg"
                p.parent.mkdir(parents=True, exist_ok=True)
                t.save(p, quality=88, optimize=True)
    return max_zoom


def bearing(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    y = math.sin(lo2 - lo1) * math.cos(la2)
    x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(lo2 - lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def dist_m(a, b, R=3389500.0):  # Mars mean radius
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--src", default="raw", help="folder with source images")
    ap.add_argument("--out", default="public/panos")
    ap.add_argument("--width", type=int, default=8192, help="max equirect width (power of 2)")
    ap.add_argument("--tile", type=int, default=512)
    ap.add_argument("--link-radius-m", type=float, default=5000)
    args = ap.parse_args()

    man = json.loads(Path(args.manifest).read_text())
    src_dir, out_dir = Path(args.src), Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    built = []

    for p in man["panos"]:
        # ids name output folders and files: keep them plain. Source files must sit directly in --src.
        if not re.fullmatch(r"[a-z0-9_]{1,40}", str(p.get("id", ""))):
            print(f"skip {p.get('id')!r}: id must be 1-40 of a-z, 0-9, _", file=sys.stderr); continue
        if Path(str(p.get("file", ""))).name != p.get("file") or p["file"] in ("", ".", ".."):
            print(f"skip {p['id']}: file must be a plain file name inside --src", file=sys.stderr); continue
        f = src_dir / p["file"]
        if not f.exists():
            print(f"skip {p['id']}: {f} not found", file=sys.stderr); continue
        if p.get("lat") is None or p.get("lon") is None:
            print(f"skip {p['id']}: no lat/lon yet (fill from PDS localizations)", file=sys.stderr); continue
        if p.get("hfov") is None:
            print(f"skip {p['id']}: set hfov (degrees covered horizontally)", file=sys.stderr); continue
        if p.get("heading") is None:
            print(f"warn {p['id']}: heading unknown, assuming image centre faces north", file=sys.stderr)
            p["heading"] = 0
        img = Image.open(f)
        hfov = float(p["hfov"])
        # Default vfov: assume equal angular scale horizontally and vertically
        vfov = float(p.get("vfov") or hfov * img.height / img.width)
        # Don't upsample past the source's native angular resolution
        native_w = img.width * 360.0 / hfov
        # A pano may raise the cap ("max_width"): narrow strips otherwise keep only a sliver of their detail.
        cap = int(p.get("max_width") or args.width)
        w = 2 ** int(math.floor(math.log2(min(cap, max(1024, native_w)))))
        # Don't reproject more source pixels than the output can hold: shrinking first is faster,
        # uses far less memory, and avoids the aliasing of bilinear sampling from a much larger image.
        need_w = int(math.ceil(w * hfov / 360.0))
        if img.width > need_w * 1.25:
            img = img.resize((need_w, max(1, round(img.height * need_w / img.width))), Image.LANCZOS)
        eq = to_equirect(img, hfov=hfov, vfov=vfov, heading=float(p.get("heading", 0)),
                         pitch=float(p.get("pitch", 0)), projection=p.get("projection", "equirect"),
                         out_w=w)
        eq.save(out_dir / f"{p['id']}_equirect.jpg", quality=90)
        zmax = cut_tiles(eq, out_dir, p["id"], args.tile)
        built.append({**p, "vfov": round(vfov, 2), "world_w": w, "max_zoom": zmax})
        print(f"built {p['id']}: {img.width}x{img.height} -> {w}x{w//2}, zoom 0..{zmax}")

    for a in built:  # neighbour links
        a["links"] = [{"pano": b["id"], "heading": round(bearing(a, b), 1),
                       "description": b["title"], "distance_m": round(dist_m(a, b))}
                      for b in built if b is not a and dist_m(a, b) <= args.link_radius_m]
    meta = {"tile": args.tile, "credit": man.get("credit", ""), "panos": {
        b["id"]: {k: b[k] for k in ("id", "title", "lat", "lon", "world_w", "max_zoom",
                                    "links", "source", "heading", "pitch", "sol", "camera", "hfov", "vfov", "waypoint")
                  if k in b} for b in built}}
    (out_dir / "panos.json").write_text(json.dumps(meta, indent=2))
    print(f"wrote {out_dir/'panos.json'} ({len(built)} panos)")


if __name__ == "__main__":
    main()
