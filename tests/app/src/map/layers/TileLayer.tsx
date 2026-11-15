// Base imagery: the MRO CTX mosaic as map tiles (built from MarsDataPipline/gale_tiles/out_tiles/imagery,
// with the design's tint baked in). Picks the tile zoom that matches the screen's pixel density and
// draws only the tiles in view, over a coarse layer of the whole crater so panning never shows a hole.
import { memo } from "react";
import { Image, PixelRatio } from "react-native";
import { dataUri, useMapData, type Manifest } from "../data";
import { TILE_PX, tileRect, tilesCovering } from "../geo";
import { useMapView, visibleWorld, type Viewport } from "../view";

type Imagery = NonNullable<Manifest["imagery"]>;
type Tile = { key: string; uri: string; x: number; y: number; w: number; h: number };

/** Lowest zoom whose tiles have at least as many pixels per world px as the screen shows. */
function pickZoom(im: Imagery, s: number): number {
  const need = s * PixelRatio.get() * 0.85; // a little under 1:1 still looks sharp, and loads 4x fewer tiles
  for (let z = im.zooms[0]; z <= im.zooms[1]; z++) if (TILE_PX / tileRect(z, 0, 0).w >= need) return z;
  return im.zooms[1];
}

function tilesFor(im: Imagery, z: number, vp: Viewport | null): Tile[] {
  const range = im.per_zoom[String(z)];
  if (!range) return [];
  let [r0, r1] = range.rows, [c0, c1] = range.cols;
  if (vp) {
    const v = visibleWorld(vp, 64);
    const cov = tilesCovering(z, v.x0, v.y0, v.x1, v.y1);
    r0 = Math.max(r0, cov.rows[0]); r1 = Math.min(r1, cov.rows[1]);
    c0 = Math.max(c0, cov.cols[0]); c1 = Math.min(c1, cov.cols[1]);
  }
  const out: Tile[] = [];
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const r = tileRect(z, row, col);
      const uri = dataUri(im.path.replace("{z}", String(z)).replace("{row}", String(row)).replace("{col}", String(col)));
      out.push({ key: `${z}/${row}/${col}`, uri, ...r });
    }
  }
  return out;
}

// Tiles overlap by a fraction of a world px so no seam shows between them at any zoom.
const TileImage = memo(function TileImage({ t }: { t: Tile }) {
  return (
    <Image
      source={{ uri: t.uri }}
      fadeDuration={0}
      resizeMode="stretch"
      style={{ position: "absolute", left: t.x, top: t.y, width: t.w + 0.6, height: t.h + 0.6 }}
    />
  );
});

export function TileLayer() {
  const { manifest } = useMapData();
  const { vp } = useMapView();
  const im = manifest?.imagery;
  if (!im) return null;
  const base = Math.min(im.zooms[0] + 1, im.zooms[1]); // whole crater, ~25 tiles: the backdrop
  const z = pickZoom(im, vp.s);
  const tiles = [...tilesFor(im, base, null), ...(z > base ? tilesFor(im, z, vp) : [])];
  return <>{tiles.map(t => <TileImage key={t.key} t={t} />)}</>;
}
