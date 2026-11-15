"""
Bake the design's map tint into an image.

The prototype tints the base map with the CSS filter
  sepia(.5) saturate(1.3) contrast(1.02) brightness(.88) hue-rotate(-8deg)
React Native can't apply CSS filters, so the tint is baked into the images instead.
build_map_data.py applies tint() to every base-map tile. To tint a single image:

  python scripts/tint_map.py in.png out.png
"""
import math
import sys

import numpy as np
from PIL import Image


def sepia(a):
    k = 1 - a
    return np.array([
        [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k],
        [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k],
        [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k],
    ])


def saturate(s):
    return np.array([
        [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
    ])


def hue_rotate(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return np.array([
        [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
        [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
        [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
    ])


def apply(rgb, m):
    return np.clip(rgb @ m.T, 0, 1)


def tint(rgb):
    """The design's map tint on an (..., 3) float array in 0-1. Also used by build_map_data.py."""
    # Same order as the CSS filter list (Filter Effects spec matrices, sRGB).
    rgb = apply(rgb, sepia(0.5))
    rgb = apply(rgb, saturate(1.3))
    rgb = np.clip(rgb * 1.02 + (0.5 - 0.5 * 1.02), 0, 1)  # contrast
    rgb = np.clip(rgb * 0.88, 0, 1)  # brightness
    return apply(rgb, hue_rotate(-8))


def main(src, dst):
    img = Image.open(src).convert("RGBA")
    a = np.asarray(img).astype(np.float64) / 255
    a[..., :3] = tint(a[..., :3])
    Image.fromarray((a * 255 + 0.5).astype(np.uint8)).save(dst, optimize=True)
    print(f"wrote {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
