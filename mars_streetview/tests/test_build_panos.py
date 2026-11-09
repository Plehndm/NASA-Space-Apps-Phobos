"""Tests for build_panos.py and fetch_raw.py, on small synthetic images (no downloads).

    app/.venv/bin/python -m unittest discover -s mars_streetview/tests     # from the repo root
    (needs Pillow and NumPy, which the app's map-data venv has)
"""
import hashlib
import http.server
import io
import json
import math
import os
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import build_panos  # noqa: E402
import fetch_raw  # noqa: E402


def red_column_image(w=360, h=90, width=1):
    """Grey image with a bright red column `width` px wide at the centre."""
    a = np.full((h, w, 3), 90, np.uint8)
    a[:, w // 2 - width // 2: w // 2 - width // 2 + width] = (255, 0, 0)
    return Image.fromarray(a)


def red_columns(eq):
    a = np.asarray(eq.convert("RGB")).astype(int)
    mid = a[a.shape[0] // 2]
    return [x for x in range(a.shape[1]) if mid[x, 0] > 200 and mid[x, 1] < 80]


class Geometry(unittest.TestCase):
    def test_bearing_and_distance(self):
        a = {"lat": -4.59, "lon": 137.44}
        self.assertAlmostEqual(build_panos.bearing(a, {"lat": -4.58, "lon": 137.44}), 0, places=6)
        self.assertAlmostEqual(build_panos.bearing(a, {"lat": -4.59, "lon": 137.45}), 90, delta=0.01)
        self.assertAlmostEqual(build_panos.bearing(a, {"lat": -4.60, "lon": 137.44}), 180, places=6)
        # 0.001° of latitude on Mars is about 59.2 m
        self.assertAlmostEqual(build_panos.dist_m(a, {"lat": -4.591, "lon": 137.44}), 59.16, delta=0.1)


class Reprojection(unittest.TestCase):
    def test_full_circle_puts_the_image_centre_at_its_heading(self):
        for heading in (0, 90, 180, 270):
            eq = build_panos.to_equirect(red_column_image(), hfov=360, vfov=90, heading=heading, pitch=0, projection="equirect", out_w=720)
            self.assertEqual(eq.size, (720, 360))
            cols = red_columns(eq)
            self.assertTrue(cols, heading)
            self.assertLessEqual(min(abs(c - heading * 2) for c in cols + [c - 720 for c in cols]), 2, (heading, cols))

    def test_partial_strip_fills_the_rest_of_the_sphere(self):
        eq = build_panos.to_equirect(red_column_image(width=8), hfov=90, vfov=22.5, heading=90, pitch=0, projection="equirect", out_w=720)
        a = np.asarray(eq).astype(int)
        # Behind the camera (bearing 270) is the plain Mars background, not imagery.
        bg = build_panos.mars_background(720, 360).astype(int)
        self.assertLess(np.abs(a[180, 540] - bg[180, 540]).max(), 3)
        self.assertTrue(red_columns(eq))

    def test_pitch_moves_the_image_down(self):
        img = red_column_image()
        a = np.asarray(img).copy()
        a[0, :] = (0, 0, 255)  # blue top row
        eq0 = np.asarray(build_panos.to_equirect(Image.fromarray(a), hfov=360, vfov=90, heading=0, pitch=0, projection="equirect", out_w=720))
        eq30 = np.asarray(build_panos.to_equirect(Image.fromarray(a), hfov=360, vfov=90, heading=0, pitch=-30, projection="equirect", out_w=720))
        row = lambda e: int(np.argmax(e[:, 360, 2] - e[:, 360, 0]))  # noqa: E731
        self.assertGreater(row(eq30), row(eq0) + 50)  # top row now 30° (60 px) lower


class Tiles(unittest.TestCase):
    def test_tile_pyramid_layout(self):
        eq = Image.new("RGB", (1024, 512), (10, 20, 30))
        with tempfile.TemporaryDirectory() as d:
            zmax = build_panos.cut_tiles(eq, Path(d), "p", 256)
            self.assertEqual(zmax, 2)
            files = sorted(p.name for p in (Path(d) / "p").iterdir())
            self.assertEqual(len(files), 1 + 4 + 16)
            self.assertIn("2_3_3.jpg", files)
            with Image.open(Path(d) / "p" / "1_0_0.jpg") as t:
                self.assertEqual(t.size, (256, 128))


class BuildRun(unittest.TestCase):
    def run_build(self, panos, images):
        d = tempfile.TemporaryDirectory()
        self.addCleanup(d.cleanup)
        root = Path(d.name)
        (root / "raw").mkdir()
        for name, img in images.items():
            img.save(root / "raw" / name)
        (root / "m.json").write_text(json.dumps({"credit": "test", "panos": panos}))
        err, out = io.StringIO(), io.StringIO()
        with redirect_stderr(err), redirect_stdout(out):
            sys.argv = ["build_panos.py", str(root / "m.json"), "--src", str(root / "raw"), "--out", str(root / "out"), "--width", "1024", "--tile", "256"]
            build_panos.main()
        return root, err.getvalue()

    def test_builds_links_and_metadata(self):
        base = {"hfov": 360, "heading": 0, "pitch": 0, "projection": "equirect", "lat": -4.59, "lon": 137.44, "sol": 2, "camera": "Navcam"}
        root, _ = self.run_build(
            [{**base, "id": "a", "title": "A", "file": "a.png", "waypoint": "bradbury"},
             {**base, "id": "b", "title": "B", "file": "b.png", "lat": -4.5895},
             {**base, "id": "far", "title": "Far", "file": "a.png", "lat": -4.9}],
            {"a.png": red_column_image(), "b.png": red_column_image()},
        )
        meta = json.loads((root / "out" / "panos.json").read_text())
        self.assertEqual(sorted(meta["panos"]), ["a", "b", "far"])
        a = meta["panos"]["a"]
        self.assertEqual([l["pano"] for l in a["links"]], ["b"])
        self.assertEqual(round(a["links"][0]["heading"]), 0)  # b is due north of a
        self.assertEqual(meta["panos"]["far"]["links"], [])
        for k in ("sol", "camera", "hfov", "vfov", "pitch", "waypoint", "world_w", "max_zoom"):
            self.assertIn(k, a)
        self.assertTrue((root / "out" / "a" / "0_0_0.jpg").is_file())

    def test_rejects_entries_that_could_leave_their_folders(self):
        base = {"hfov": 360, "lat": 0, "lon": 0}
        root, err = self.run_build(
            [{**base, "id": "../../evil", "file": "a.png"}, {**base, "id": "ok", "file": "../m.json"},
             {**base, "id": "ok2", "file": "/etc/passwd"}, {**base, "id": "nopos", "file": "a.png", "lat": None}],
            {"a.png": red_column_image()},
        )
        meta = json.loads((root / "out" / "panos.json").read_text())
        self.assertEqual(meta["panos"], {})
        self.assertIn("id must be", err)
        self.assertEqual(err.count("plain file name"), 2)
        self.assertIn("no lat/lon", err)
        self.assertEqual(sorted(p.name for p in (root / "out").iterdir()), ["panos.json"])

    def test_keeps_a_ceiling_on_image_size(self):
        self.assertIsNotNone(Image.MAX_IMAGE_PIXELS)
        self.assertLessEqual(Image.MAX_IMAGE_PIXELS, 2_000_000_000)


class Fetch(unittest.TestCase):
    def entry(self, **kw):
        e = {"id": "p", "file": "x.jpg", "download": "https://assets.science.nasa.gov/a/x.jpg", "bytes": 3, "sha256": hashlib.sha256(b"abc").hexdigest()}
        e.update(kw)
        return e

    def test_accepts_nasa_https_downloads_only(self):
        self.assertEqual(fetch_raw.check_entry(self.entry())[0], "x.jpg")
        for bad in (
            {"download": "http://assets.science.nasa.gov/a/x.jpg"},
            {"download": "https://evil.example/x.jpg"},
            {"download": "https://assets.science.nasa.gov.evil.example/x.jpg"},
            {"download": "file:///etc/passwd"},
            {"file": "../x.jpg"}, {"file": "a/x.jpg"}, {"file": ".."},
            {"sha256": "abc"}, {"bytes": 0}, {"bytes": "3"},
        ):
            with self.assertRaises(ValueError, msg=bad):
                fetch_raw.check_entry(self.entry(**bad))

    def test_checks_existing_files_by_size_and_hash(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "x.jpg"
            f.write_bytes(b"abc")
            digest = hashlib.sha256(b"abc").hexdigest()
            self.assertTrue(fetch_raw.is_ok(f, 3, digest))
            self.assertFalse(fetch_raw.is_ok(f, 4, digest))
            f.write_bytes(b"abd")
            self.assertFalse(fetch_raw.is_ok(f, 3, digest))
            self.assertFalse(fetch_raw.is_ok(Path(d) / "missing", 3, digest))

    def test_check_mode_reports_missing_files_without_downloading(self):
        with tempfile.TemporaryDirectory() as d:
            m = Path(d) / "m.json"
            m.write_text(json.dumps({"panos": [self.entry()]}))
            with redirect_stderr(io.StringIO()) as err, redirect_stdout(io.StringIO()):
                code = fetch_raw.main([str(m), "--dest", str(Path(d) / "raw"), "--check"])
            self.assertEqual(code, 1)
            self.assertIn("BAD", err.getvalue())
            (Path(d) / "raw" / "x.jpg").write_bytes(b"abc")
            with redirect_stdout(io.StringIO()) as out:
                self.assertEqual(fetch_raw.main([str(m), "--dest", str(Path(d) / "raw"), "--check"]), 0)
            self.assertIn("ok", out.getvalue())

    def test_refuses_a_download_that_ends_off_the_allowed_host(self):
        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("content-length", "3")
                self.end_headers()
                self.wfile.write(b"abc")

            def log_message(self, *a):
                pass

        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        with tempfile.TemporaryDirectory() as d:
            dest = Path(d) / "x.jpg"
            with self.assertRaises(ValueError):
                fetch_raw.fetch(f"http://127.0.0.1:{srv.server_port}/x.jpg", dest, 3, hashlib.sha256(b"abc").hexdigest())
            self.assertEqual(os.listdir(d), [])  # nothing kept, no partial file left


class Manifest(unittest.TestCase):
    """The real manifest: every pano is buildable and fetchable as written."""

    def test_manifest_is_complete(self):
        man = json.loads((HERE / "manifest.json").read_text())
        ids = [p["id"] for p in man["panos"]]
        self.assertEqual(len(ids), len(set(ids)))
        for p in man["panos"]:
            fetch_raw.check_entry(p)  # raises if download / bytes / sha256 / file are wrong
            for k in ("lat", "lon", "hfov", "heading", "pitch", "sol", "camera"):
                self.assertIsNotNone(p.get(k), f"{p['id']}: {k}")
            self.assertTrue(-90 <= p["lat"] <= 90 and 0 < p["hfov"] <= 360, p["id"])
            self.assertTrue(math.isfinite(p["heading"]), p["id"])


if __name__ == "__main__":
    unittest.main()
