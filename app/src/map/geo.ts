// The one coordinate system every map layer uses.
//
// World space is the pipeline's 100 m grid (the THEMIS template in MarsDataPipline: the dust-devil
// feature table, the heat maps at 2 x 2 blocks of it, and the CTX/topo tile box). One world px is one
// grid cell: about 100 m. x grows east, y grows south; (0, 0) is the north-west corner of the grid.
//
//   lon = LON0 + x * DLON        lat = LAT0 + y * DLAT        (x, y continuous; integers are cell corners)
//
// Constants come from the pipeline's heat-map manifest (grid.transform_gdal, halved back to 100 m).
// scripts/build_map_data.py writes the same values into data/manifest.json and checks them.

export const GRID = {
  W: 1477, // columns (x)
  H: 1436, // rows (y)
  LON0: 136.7490510333193, // west edge of column 0, degrees east
  DLON: 0.001687051876845213, // degrees per column
  LAT0: -4.148577212911933, // north edge of row 0, degrees (planetocentric)
  DLAT: -0.0016870993139129456, // degrees per row (negative: rows go south)
} as const;

export const MARS_RADIUS_M = 3_396_190;

/** Metres per world px (north–south; east–west is within 0.5 % of this across the grid). */
export const M_PER_PX = Math.abs(GRID.DLAT) * (Math.PI / 180) * MARS_RADIUS_M; // ≈ 100.0

export interface Pt { x: number; y: number }
export interface LonLat { lon: number; lat: number }

export const toLonLat = (p: Pt): LonLat => ({ lon: GRID.LON0 + p.x * GRID.DLON, lat: GRID.LAT0 + p.y * GRID.DLAT });
export const toWorld = (ll: LonLat): Pt => ({ x: (ll.lon - GRID.LON0) / GRID.DLON, y: (ll.lat - GRID.LAT0) / GRID.DLAT });

export const inWorld = (p: Pt) => p.x >= 0 && p.y >= 0 && p.x < GRID.W && p.y < GRID.H;

/** Great-circle distance in metres between two world points. */
export function distanceM(a: Pt, b: Pt): number {
  const A = toLonLat(a), B = toLonLat(b), r = Math.PI / 180;
  const dLat = (B.lat - A.lat) * r, dLon = (B.lon - A.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** "4.59°S 137.44°E" */
export function fmtLatLon(p: Pt, digits = 2): string {
  const { lon, lat } = toLonLat(p);
  return `${Math.abs(lat).toFixed(digits)}°${lat < 0 ? "S" : "N"} ${lon.toFixed(digits)}°E`;
}

/** "−4,501": thousands separators and a true minus (Hermes has no reliable toLocaleString). */
export function fmtInt(n: number): string {
  const s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < -0.5 ? `−${s}` : s;
}

// --- Map tiles (Mars Trek / gale_tiles grid: geographic, 256 px, 180 / 2^z degrees per tile) ---

export const TILE_PX = 256;
export const tileDeg = (z: number) => 180 / 2 ** z;

/** World-px rectangle of tile z/row/col. */
export function tileRect(z: number, row: number, col: number) {
  const deg = tileDeg(z);
  const nw = toWorld({ lon: -180 + col * deg, lat: 90 - row * deg });
  return { x: nw.x, y: nw.y, w: deg / GRID.DLON, h: deg / -GRID.DLAT };
}

/** Rows and columns of zoom-z tiles that cover a world-px rectangle. */
export function tilesCovering(z: number, x0: number, y0: number, x1: number, y1: number) {
  const deg = tileDeg(z);
  const a = toLonLat({ x: x0, y: y0 }), b = toLonLat({ x: x1, y: y1 });
  return {
    rows: [Math.floor((90 - a.lat) / deg), Math.floor((90 - b.lat) / deg)] as const,
    cols: [Math.floor((a.lon + 180) / deg), Math.floor((b.lon + 180) / deg)] as const,
  };
}
