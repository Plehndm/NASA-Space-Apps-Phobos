# Mars Street View

Turns Curiosity panoramas into tiled 360° spheres for the app's Street Level view.

## 1. Get the imagery into `raw/`
```
python3 fetch_raw.py            # download what is missing; python3 fetch_raw.py --check only verifies
```
Each pano's `download`, `bytes` and `sha256` in `manifest.json` name the exact file. `fetch_raw.py` (standard library only) downloads only from NASA's asset server (`assets.science.nasa.gov`, https), checks size and checksum before keeping a file, and leaves files that already match alone. `raw/` is git-ignored. Or run `npm run panos` from `app/` to download and build in one go.

## 2. The manifest
Every pano is filled in; each one's `_how` says where its numbers came from.
- `lat`, `lon`: from PDS `msl_places/data_localizations/localized_pos.csv`, the last ROVER row at or before the pano's sol.
- `hfov`: from the caption, or from the camera's pixel scale (Mastcam M-100 0.074 mrad/px, M-34 0.218 mrad/px, Navcam 0.82 mrad/px).
- `heading`: compass bearing of the image centre, from the caption, or by matching Mount Sharp in the image to its bearing on the app's terrain grid.
- `pitch`: elevation of the image's vertical centre. Rover mosaics mostly look down, so it is measured from the horizon row.
- `projection`: NASA "cylindrical" mosaics are evenly spaced in elevation, so they build as `equirect`.
- `waypoint` (optional): the app landmark id this pano shows. `max_width` (optional): raise the sphere width for narrow, detailed strips.

## 3. Build
```
../app/.venv/bin/python build_panos.py manifest.json --src raw --out ../app/data/panos
```
Outputs per pano: a 2:1 equirect preview (`<id>_equirect.jpg`), a tile pyramid (`<id>/<zoom>_<x>_<y>.jpg`), and `panos.json` with links between waypoints within 5 km (`--link-radius-m`). The Expo dev server serves `app/data/` at `/mapdata/`, so the app picks them up with no other setup.

## 4. In the app
Street Level is built into the app (`app/src/street/`, opened from the Waypoint eye button); see app/README.md. `streetview.js` is the original Google Maps version and is not used by the app.

## 5. Tests
```
../app/.venv/bin/python -m unittest discover -s tests     # from mars_streetview/
```
Synthetic images, no downloads: reprojection (heading, pitch, partial strips), the tile pyramid, links and metadata, the build's path guards, `fetch_raw.py`'s host allowlist and checksums, and a check that every manifest entry is complete.

Credit: NASA/JPL-Caltech/MSSS (imagery), USGS Astrogeology (orbital).
