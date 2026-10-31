# Mars Street View

Turns Curiosity panoramas into Google Maps custom Street View panoramas.

## 1. Get the imagery into `raw/`
Download each image named in `manifest.json` (`file` field) from its `source` page. Use the full-res TIFF/JPG, not the page preview.

## 2. Fill in the manifest
For every pano, set:
- `lat`, `lon`: rover position for that sol, from `MSLPLC_1XXX/DATA/LOCALIZATIONS` (planetocentric, east-positive). Bradbury Landing is prefilled.
- `hfov`: degrees the image spans horizontally (360 for full panoramas, 130 for PIA20333; read the others off the caption).
- `heading`: compass azimuth the image *centre* faces. Captions usually say what's at the centre ("Mount Sharp, to the south"). Until set, north is assumed.
- `vfov`: leave null unless the caption states it; it's derived from the aspect ratio.

Panos without `lat`/`lon` or `hfov` are skipped, not failed. Two panos at the same spot (the two Bradbury ones) should be cut to one.

## 3. Build
```
pip install pillow numpy
python build_panos.py manifest.json --src raw --out public/panos
```
Outputs per pano: a 2:1 equirect preview (`<id>_equirect.jpg`), a tile pyramid (`<id>/<zoom>_<x>_<y>.jpg`), and `panos.json` with links between waypoints within 5 km (`--link-radius-m`).

## 4. Wire into the map
```js
import { initMarsStreetView } from "./streetview.js";
const sv = await initMarsStreetView(map, "/panos");   // adds clickable waypoint markers
sv.open("bradbury_navcam360");
```
Arrows inside Street View walk between linked waypoints.

Credit: NASA/JPL-Caltech/MSSS (imagery), USGS Astrogeology (orbital).
