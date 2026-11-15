"""Dust-storm textures for the fog around the map (src/map/layers/StormLayer.tsx).

    python scripts/make_storm_textures.py        (from app/; needs numpy and Pillow)

Writes two PNGs to app/assets/:
  storm.png  512 x 512, opaque, tiles seamlessly: wind-streaked dust, darker in the gaps.
  wisp.png   1024 x 512, transparent: one soft cloud of lighter dust, drifted over the storm.

Noise is white noise shaped in the frequency domain (amplitude ~ 1/f^beta), which wraps around by
construction, so the storm texture has no seams. Stretching the spectrum in x makes streaks along x,
like dust blown by wind. Fixed seeds: re-running gives the same files.
"""
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "assets"
DEEP = np.array([52, 30, 22], float)    # storm gaps (a little lighter than the app's --bg1)
DUST = np.array([150, 98, 68], float)   # thick dust
WISP = np.array([212, 156, 116], float)  # sunlit dust in the wisps


def noise(h: int, w: int, beta: float, stretch: float, seed: int) -> np.ndarray:
    """Seamless fractal noise in 0..1, streaked along x when stretch > 1."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :] * stretch  # x frequencies weigh more, so less change along x: streaks along x
    f = np.hypot(fx, fy)
    f[0, 0] = 1.0
    spec = np.fft.fft2(rng.standard_normal((h, w))) / f**beta
    spec[0, 0] = 0
    n = np.real(np.fft.ifft2(spec))
    lo, hi = np.percentile(n, [1, 99])
    return np.clip((n - lo) / (hi - lo), 0, 1)


def storm() -> None:
    n = 0.65 * noise(512, 512, 1.6, 2.4, 7) + 0.35 * noise(512, 512, 1.1, 1.0, 11)
    n = n**1.3  # more dark gaps, brighter billows
    rgb = DEEP + (DUST - DEEP) * n[..., None]
    Image.fromarray(rgb.astype(np.uint8), "RGB").save(OUT / "storm.png", optimize=True)


def wisp() -> None:
    h, w = 512, 1024
    n = noise(h, w, 1.5, 2.0, 23)
    y, x = np.mgrid[0:h, 0:w]
    r = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2))
    mask = np.clip(1 - r, 0, 1) ** 1.6  # soft ellipse, zero at the image edge
    a = np.clip(n * 1.4 - 0.25, 0, 1) * mask * 0.8
    rgba = np.dstack([np.broadcast_to(WISP, (h, w, 3)), a[..., None] * 255]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(OUT / "wisp.png", optimize=True)


if __name__ == "__main__":
    storm()
    wisp()
    print(f"wrote {OUT / 'storm.png'} and {OUT / 'wisp.png'}")
