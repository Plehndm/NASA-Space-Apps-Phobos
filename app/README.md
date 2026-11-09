# Mars Navigator app

React Native + Expo (SDK 58) + TypeScript. One codebase runs on phones through **Expo Go** and on desktop in a **web browser**. It is built from the HTML prototype in `../Mars Navigator App Design/`; read that folder's README for the exact look and behaviour of every screen.

## Run it

```bash
cd app
npm install
npx expo start           # terminal 1: the app
npm run data             # terminal 2: the map data server (port 8092), see "Map data" below
```

`npx expo start` prints a QR code and waits. Every save reloads on all connected devices. Without the data server the app still runs, but the map is empty and shows "MAP DATA OFFLINE".

### Phone (Expo Go)

1. Install **Expo Go** from the App Store or Google Play. It must support **SDK 58**; update Expo Go if it says the project is incompatible.
2. Put the phone on the **same Wi-Fi** as the computer.
3. Scan the QR code:
   - **Android:** use the scanner inside Expo Go.
   - **iPhone:** use the Camera app, then tap the banner to open in Expo Go.

### Desktop (web)

With `npx expo start` running, press **w** in the terminal, or open <http://localhost:8081>. Add these to the URL:

| Option | Effect |
| --- | --- |
| `?device=phone` | Phone layout in the prototype's 393×852 frame, for side-by-side comparison |
| `?device=desktop` | Desktop layout |
| `?scene=settings` | Opens Settings on load |

Without `?device`, windows 900 px wide or wider get the desktop layout and narrower ones get the phone layout. Phones always get the phone layout.

### Compare with the design reference

The legacy HTML prototype in `../Mars Navigator App Design/` shows how every screen should look and behave. To run it next to the app:

```bash
npm run design           # in a second terminal, from app/
```

Open <http://localhost:8090> on the desktop. The page links the phone, desktop and slide-deck versions. On a phone on the same Wi-Fi, use the `Phone:` address it prints. Put the prototype and the app side by side, for example the app at `?device=phone` beside the prototype's phone version.

The prototype is a reference only. Don't build on it or import from it.

### If the phone can't connect

- **Campus or public Wi-Fi** (eduroam, cafés) often blocks devices from reaching each other. Run `npx expo start --tunnel` instead. It works over the internet; the first time, it asks to install `@expo/ngrok`, so answer yes. Or connect the computer to the phone's hotspot.
- **Windows firewall:** if Windows asks whether Node.js may use the network, allow **Private networks**. Then set your Wi-Fi to Private: Settings → Network & internet → Wi-Fi → your network → Network profile type → Private.
- **"Project is incompatible with this version of Expo Go":** update Expo Go from the app store.

## Map data

The map layers are real pipeline outputs, built into `app/data/` (about 30 MB, not in git) and served by `npm run data`. The app finds that server on the same host as the Expo dev server, so phones on the same Wi-Fi need no setup.

**First time:** get the inputs, then build. Download these from the team Drive (link in `MarsDataPipline/processed_data/Google_Drive`) into the same paths under `MarsDataPipline/`:

| File (under `MarsDataPipline/`) | Used for |
| --- | --- |
| `processed_data/gale_dem_20m.tif` and `gale_slope_20m.tif` | elevation and slope (coordinate pill, strata, routing) |
| `heatmap/outputs/maps/{ground,air}/map_manifest.json` and `raw/*.u16` | temperature frames |
| `dust_devil/outputs/gale_dust_devil_heating_index_sol{800,1850}.npz` and `dust_devil_heating_index_reference_sol1850.json` | dust-devil layer and Home advisory |
| `processed_data/mastcam_tau_per_sol.csv` | dust opacity τ on the Home card |

```bash
python scripts/fetch_imagery.py      # CTX tiles, zooms 7-11, from NASA Mars Trek (~56 MB, resumable)
python3 -m venv .venv && .venv/bin/pip install numpy pillow rasterio   # once
.venv/bin/python scripts/build_map_data.py   # -> app/data/ (about 40 s)
npm run data
```

`build_map_data.py` takes stage names to rebuild only part: `imagery`, `terrain`, `strata`, `heat`, `dustDevil`, `telemetry`. Or skip the build: unzip a teammate's `app/data/` into place.

**Phone on another network, or a hosted demo:** copy `app/data/` to any static host and put its address in `app/.env.local` as `EXPO_PUBLIC_DATA_URL=https://…`, then restart Expo. Tunnel mode (`--tunnel`) needs this too, because the phone can't reach port 8092 directly.

| Layer | Source | App file |
| --- | --- | --- |
| Base imagery | MRO CTX mosaic (Mars Trek `Gale_CTX_BlockAdj_dd`), the pipeline's tile grid, tint baked in | `imagery/{z}/{row}/{col}.jpg` |
| Terrain | 20 m CTX DTM and slope rasters resampled to 100 m: elevation, mean slope, upper-quartile slope | `terrain.bin` |
| Elevation strata | same: L1 above −2 km, L2 −4 to −2 km, L3 below −4 km | `strata/l{1,2,3}.webp` |
| Temperature | ground and air maps: 5 seasons (Ls 15/75/195/255/340) × 48 frames, inferno 150–320 K | `heat/{ground,air}/ls{LLL}/{HHMM}.webp` |
| Dust devils | Dust Devil Heating Index, sols 1850 (clear) and 800 (dusty), levels low/moderate/high | `dustdevil/sol{N}.webp`, `sol{N}_level.bin` |
| Telemetry | Mastcam τ per sol; ground temperature at 400 m per season and LTST frame (uint8 on the 150–320 K scale) | `telemetry/tau.json`, `telemetry/ground/{season}/{HHMM}.bin` |

### Checks before you push

```bash
npm run typecheck        # TypeScript
npm test                 # 91 unit and HTTP tests (Vitest), well under a second
npm run test:py          # Street Level build/fetch tests and the repo-wide doc link check (Python)
npm run test:all         # all three
npm run doctor           # Expo dependency and config checks
```

The tests in `app/tests/` cover what can run without a phone: the route planner on synthetic terrain (and on the real terrain to every landmark, when `app/data/` is built), search and coordinate parsing, τ, landmark positions, the panorama list and looping strip, the offline assistant's answers and sector snapshot, and both dev-server middlewares over real HTTP (map data: path traversal, symlinks, methods, gzip; assistant: key handling, origin and host checks, size and rate limits, upstream errors, against a fake Claude API, so no key is used). React Native and Expo are stubbed (`tests/stubs/`), so screens and gestures are still checked by hand in the iOS Simulator and the browser. `mars_streetview/tests/` and `tests/` (repo root) hold the Python tests; `test:py` needs the map-data venv in `app/.venv`.

Add libraries with `npx expo install <package>`, not `npm install`. It picks the version that matches SDK 58. Only libraries included in Expo Go will work in Expo Go; check the library's page on docs.expo.dev for "Included in Expo Go".

## What's built (checklist section 1: App foundation)

- **Design tokens + theme:** `src/theme.ts`.
  - Colours (`C`), radii (`R`), shadows (`SHADOW`), gradients, and `font(weight, size)`.
  - Use these, never raw hex.
  - Put all text in `<T>` from `src/ui/Text.tsx` so it gets the Plus Jakarta Sans font.
- **Layout shells:** `src/layout/geometry.ts` and `src/shell/Sheet.tsx`.
  - Phone: bottom sheet with peek / half / full snap points. Drag the handle, or tap it to step through the points. The map dims as the sheet rises. The header and sheet allow for the notch and home bar.
  - Desktop: fixed 420 px left panel. Both layouts use the same components.
- **Header, dock, toasts:**
  - `Header.tsx`: Sol + ticking MTC clock, status pill, settings gear.
  - `Dock.tsx`: Layers, Hazards (with status dot), HM, ✦ Assistant, zoom.
  - `Toast.tsx`: transient messages, shown with `toast("…")`.
  - Android's back button closes Settings, then popovers, then returns to Home.
- **Settings dialog:** `src/shell/SettingsDialog.tsx`. Every setting from the prototype. Values are saved on the device.

## What's built (checklist section 2: Map and layers)

- **Map engine:** `src/shell/MapArea.tsx`. One-finger pan, two-finger pinch (with pan), mouse-wheel and trackpad zoom around the cursor on web, tap for the coordinate pill ("4.59°S 137.44°E · −4,498 m · 2° slope"), scale bar, recenter on the rover. Zoom 0.25–4.2 screen px per 100 m.
- **Coordinate system:** `src/map/geo.ts`. World space is the pipeline's 100 m grid (1477 × 1436 cells, 136.75–139.24° E, 4.15–6.57° S); one transform for every layer.
- **Data hosting:** `src/map/data.ts` loads `manifest.json` and the terrain grid; `scripts/build_map_data.py`, `scripts/serve-data.mjs`.
- **Layers** (`src/map/layers/`): CTX tiles, elevation strata, temperature (ground / air, season, LTST slider + play, kelvin legend), hazard zones with type filters, the dust-devil heating index, 19 landmarks with rank-based labels and a selected state, the rover.
- **Layer controls:** `src/map/LayerControls.tsx`, used by the dock popovers (`src/layers/DockPopovers.tsx`) and the Layers card (`src/cards/Layers.tsx`).
- **Everything is reachable with default settings.** Settings → Layer picker = DOCK (the default) opens popovers from the Layers and HM buttons; the elevation popover's **ALL LAYERS** opens the Layers card (landing points, dust-devil sol, every layer at once). While warning zones are on (⚠ button), a **WARNING ZONES · FILTER BY HAZARD** row with the five hazard chips and an "x/5 ON" count sits at the top of the Home, Waypoint, Sequence and Expedition sheets, as in the design. With Layer picker = PANEL, the Layers button opens the Layers card directly. The other settings only switch between two presentations of the same feature (hazard banner or advisory card, stepped or compact progress, chip counts or codes).
- **Landmarks and hazards:** `src/map/landmarks.ts`, `src/map/hazards.ts`. Real sites use approximate published positions; the invented ones (habitat, relays, pads, checkpoints) and the hazard zones are placed on suitable real ground, read from the terrain data. Each file says how.

## Where your feature goes

```text
src/
├── App.tsx                fonts, safe areas, status bar
├── theme.ts               design tokens
├── state/store.tsx        app state + actions: useApp()
├── state/settings.ts      Settings type and defaults
├── state/clock.ts         MTC clock (useMtcClock, mtcSeconds, fmtClock)
├── layout/geometry.ts     frame size, panel width, safe areas, sheet snap points
├── ui/                    shared pieces: T (text), Card, SectionLabel, Segmented, Switch, BlinkDot, icons
├── shell/                 header, dock, sheet, search bar, toast, settings, map area (gestures)
├── map/geo.ts             the world grid: lon/lat ↔ world px, distances, tile maths
├── map/data.ts            data server URL, manifest, terrain grid (terrainAt)
├── map/view.tsx           live map view (one Reanimated shared value), <Pin> for markers, useLabelFade
├── map/layers/            one component per map layer
├── map/LayerControls.tsx  layer controls shared by the popovers and the Layers card
├── map/MapOverlays.tsx    coordinate pill, scale bar, heat legend, recenter button
├── layers/DockPopovers.tsx  elevation + heat popovers beside the dock
├── assistant/             route assistant: backend client, sector snapshot, scripted fallback, chat state
├── street/                Street Level: panorama list (panos.ts), 360° viewer (PanoView.tsx), screen (StreetLevel.tsx)
└── cards/CardStack.tsx    one entry per sheet mode
```

- **A sheet screen**: create `src/cards/<Name>.tsx` and add it to the mode's entry in `src/cards/CardStack.tsx`.
- **A map layer:**
  - **Images** (rasters that should zoom with the map): add a component in `src/map/layers/` and list it inside the world container in `src/shell/MapArea.tsx`, positioned absolutely in world px (`toWorld({ lon, lat })` from `geo.ts`).
  - **Markers, labels, lines and shapes:** put them in the overlay next to `LandmarkLayer` and wrap each in `<Pin x y>`. iOS stretches anything inside the zoomed container, so text and SVG there go blurry; `HazardLayer` shows how to draw a shape for the current zoom. Use `react-native-svg` for shapes and routes.
  - **Reading the live view:** `useMapView().view` is one Reanimated shared value `{ s, tx, ty }`. Keep scale and position in that one value: as three separate animated values, iOS can draw a frame with the new zoom but the old position (a visible jump).
- **Terrain under a point:** `terrainAt(useMapData().terrain, p)` gives elevation and slope at 100 m. For routes and profiles use `useRoutes()` (`routeOpts`, `activeRoute`, `profileOf`).
- **Moving the map:** `centerOn(p, zoom?)` glides to a world point, `zoomBy(k, x, y)` zooms around a point, `showCoord(text)` shows the pill.
- **Something pinned above the search bar** (the ETA card while navigating): pass it to `<Sheet pinned={…} />`.

## What's built (checklist section 3: Routing and navigation)

- **Router** (`src/route/router.ts`, plain TypeScript, no React): the design's A* on a 200 m grid of the real DEM, with a tangent grade cap, cost `d·(1+3·(grade/cap)²)`, extra cost on rough cells (upper-quartile 20 m slope over the cap) and, on safe routes, on strong dust-devil heating; then line-of-sight smoothing. Route #1 (direct) caps at 25° and ignores hazards; Route #2 (safe) uses Settings → Rover grade limit and blocks every enabled hazard zone. "Override" lifts both to 45° for one target. A route across the crater takes about 25–100 ms.
- **Route state and actions** (`src/route/RouteProvider.tsx`, `useRoutes()`): cached routes, select / add stop / navigate / reorder / remove, the 100 ms expedition simulation (speed by grade × demo speed), via-points, automatic safe reroute, "Nearest safe approach" / "Nearest reachable point".
- **On the map** (`src/route/RouteLayer.tsx`): active route with casing, grades over 12° in warm, the alternative as dots, tappable time pills, the driven part dimmed. Sequence stops get numbered badges.
- **Cards** (`src/cards/`): `Waypoint.tsx` (route picker, elevation profile, Add stop / Street Level / NAVIGATE, "No safe route found"), `Sequence.tsx` (multi-stop, ↑ ↓ ×, Route #1 hazard warning), `Expedition.tsx` (stepped and compact progress cards, the pinned ETA card, hazard and steep-grade warnings, REROUTE / via-points, Arrived).
- Street Level opens from the Waypoint eye button (section 6).

## What's built (checklist section 4: Search and home)

- **Search** (`src/cards/Search.tsx`, `src/home/search.ts`, `src/shell/SearchBar.tsx`): category chips with counts or codes (Settings → Category chips), results nearest first, recent searches (kept on the device, max 4, Clear History), Enter opens the nearest match and Escape (web) leaves. Coordinates like `4.6S 137.4E` jump the map there. While searching, non-matching markers dim and matches keep their labels. With a sequence planned (or during a drive), picking a result adds it as a stop. The field keeps its own text and updates the store 120 ms after typing pauses, so fast typing isn't dropped on iOS.
- **Home** (`src/cards/Home.tsx`): sector card (tap to recenter), the three nearest landmarks, and the dust-devil advisory from the real heating-index grid (nearest strongly heated ground; WATCH under 5 km). Settings → Hazard alerts = TOP BANNER shows the nearest hazard as a blinking pill on the map instead (`src/map/MapOverlays.tsx`). The sector card and advisory also sit under the Waypoint and Arrived cards, as in the design.
- **Live telemetry** (`src/home/telemetry.ts`): surface temperature from the ground model at the rover (season nearest the sol's Ls, frame for the rover's local solar time, refreshed each minute), τ for the demo sol from the Mastcam table (interpolated within 5 sols, as the pipeline does), slope from the DEM.

## What's built (checklist section 5: Route assistant)

The assistant runs **offline**: no API key is configured, and every answer comes from the scripted fallback below, built on the app's own sector data. The status line reads "OFFLINE ASSISTANT · answers from sector data". A backend for a live Claude model is in place but switched off; it has only been tested against a local mock of the API, never the real one.

- **Chat** (`src/cards/Assistant.tsx`, `src/assistant/AssistantProvider.tsx`): bubbles, TRY suggestions, a busy pill, the status line, and a PROPOSED ROUTE card under any answer that plans one (stops with leg lengths, total distance and time including 25 min per stop, AVOIDS). LOAD ROUTE puts the stops in the multi-stop sequence on Route #2 (not during an expedition). The input row is pinned under the chat and rides above the iOS keyboard. The conversation survives closing the assistant.
- **Scripted answers** (`src/assistant/scripted.ts`): by keyword, from the planned routes, hazard zones, dust-devil heating and telemetry: a named landmark (safe route, or why it's blocked), hazards toward a named place, a general hazard check, a 3-stop science day (the nearest reachable science sites), weather and dust, or a short help text.
- **Live-model backend, off** (`scripts/assistant-middleware.js`, `src/assistant/api.ts`, `src/assistant/context.ts`): `POST /api/assistant` on the Expo dev server would call the Claude API (Claude Opus 5.5) with the key held on the server, never in the app. The app sends the conversation and a snapshot of the sector; the server caps every field, writes the system prompt itself, and keeps only landmark and hazard ids the app sent. `GET /api/assistant` reports whether a key is set; with none, the app never sends chat to the server. Any failure falls back to the scripted answers.
  - To try it: create `app/.env.local` (git-ignored) with `ANTHROPIC_API_KEY=sk-ant-...` and restart Expo. Never use an `EXPO_PUBLIC_…` name, which is built into the app. The Claude API is billed per use and the cost per message hasn't been measured, so use a spend-limited key and check the live path before relying on it.
  - Limits: 12 requests a minute per address, 3 at once, 64 KB bodies, 16 messages of history, JSON only. Requests must come from the app's own origin or a native app, and the Host must be an IP address, `localhost` or an Expo tunnel (blocks DNS-rebinding pages). The dev server listens on your network, so anyone on the same Wi-Fi could reach a configured key.
  - Hosted: `ANTHROPIC_API_KEY=… npm run assistant` (port 8093), with `ASSISTANT_ALLOW_HOSTS=<domain>`, `ASSISTANT_ALLOW_ORIGINS=https://<web app origin>` for a web build elsewhere, and the app built with `EXPO_PUBLIC_ASSISTANT_URL=https://<domain>/api/assistant`.

## What's built (checklist section 6: Street Level)

- **Panoramas** (`mars_streetview/`): five NASA Curiosity panoramas in `raw/` (git-ignored, about 113 MB, from science.nasa.gov/photojournal): Bradbury Landing (Navcam, sol 2, 360°), Rocknest (Mastcam, sol ~70, 171°), Point Lake by Yellowknife Bay (Mastcam, sol 106, 360°), Naukluft Plateau (Mastcam, sol 1284, 130°), and Gale's north rim toward Peace Vallis (Mastcam, sol 4640, 102°). The two GigaPan sources in the original manifest had no full-resolution download, so Rocknest and Point Lake use their official Photojournal versions. `manifest.json` records where every value came from (`_how`): positions from the PDS localization table, field of view from captions or the camera's pixel scale, centre heading from captions or from Mount Sharp's bearing on the terrain grid, pitch from each image's horizon row.
- **Download and build** (from `app/`, with the map-data venv):

  ```bash
  npm run panos
  ```

  `fetch_raw.py` downloads the five images (113 MB) from NASA's asset server into `mars_streetview/raw/`, checking each against the size and SHA-256 in the manifest, and skips files already there; then `build_panos.py` builds them. The build takes about 1.5 minutes and 14 GB of memory; writes 32 MB of tiles and `panos.json` to `app/data/panos/`, which the Expo dev server already serves at `/mapdata/panos/`. Bradbury, Rocknest and Point Lake are within 5 km of each other, so they link; the two rim views stand alone.
- **Viewer** (`src/street/`): replaces `mars_streetview/streetview.js` (Google Maps only, not used by the app). It fills the screen with real imagery and turns without end. Zoom-out and tilt stop at the edge of the imagery (trimmed 8% top and bottom for the ragged mosaic edges), so the empty sphere never shows. A full circle simply goes round. A partial panorama (Rocknest 171°, Naukluft 130°, the rim view 102°) repeats end to end with a faint seam where its edges meet. The compass, HDG and walking arrows always give the true bearing of what is on screen, and the compass ticks tighten as you zoom in. Drag to turn, flick to keep turning (it eases to a stop; touch to catch it), pinch or the mouse wheel to zoom, arrow keys and +/- on web, Escape or Back to leave. Only the tiles in view are drawn, at the zoom that matches the screen, over the whole sphere at zoom 0 so there is never a hole. The view is a flat window onto the sphere (no perspective correction), so lines bend slightly near the top and bottom of a wide view. On a phone a short strip opens zoomed in, because its full height has to fill a tall screen.
- **Opening it:** the Waypoint eye button opens the panorama assigned to that waypoint in the manifest (`"waypoint"`), else the nearest within 3 km; it is dimmed, with a toast, when there is none. It faces the waypoint when that direction has imagery, otherwise the centre of the image. Navigate here starts an expedition to the waypoint the panorama shows.
- **Walking:** arrows on the ground point at linked panoramas (from `links` in `panos.json`, with name, distance and direction); tap one to walk there, facing the way you walked. Links out of view show as chips at the edge: tap one to turn toward it, or, when its bearing has no imagery (Bradbury seen from Rocknest), to walk straight there.
- `panos.json` is checked on load (ids, numbers in range, links only between known panoramas). The build rejects ids and file names that could leave its folders, and keeps a 1-gigapixel ceiling on source images.

## Using the store

```tsx
import { useApp } from "../state/store";

const { state, geo, settings, patch, setMode, snapTo, toast, zoomBy, centerOn } = useApp();
setMode("waypoint", "half");   // switch the sheet screen and snap the phone sheet
patch({ hazOn: true });        // merge fields into state
toast("Navigation started");   // 3.2 s message
settings.maxGrade;             // resolved settings (defaults + user changes)
```

Add the fields your feature needs to `AppState` in `store.tsx`, with a default in `AppProvider`.

## Differences from the HTML prototype

React Native can't do everything CSS does. These are the deliberate differences:

- **Map tint:** the CSS `filter` tint is baked into the imagery tiles by `build_map_data.py` (using `scripts/tint_map.py`).
- **"Pebble" corners:** these are elliptical in CSS. Here each corner is circular, using the average of its two radii.
- **Backdrop blur:** the frosted blur behind the header, sheet and dialog is not used. The surfaces rely on the design's semi-transparent colours.
- **Real map instead of the prototype's:** the prototype's 51 × 68 km base image, fake terrain and 21 one-season heat frames are replaced by the pipeline's 148 × 144 km grid (see "Map data"). So the zoom goes down to 0.25 to show the whole crater, the heat legend uses the pipeline's fixed 150–320 K inferno scale (the prototype's provisional 180–280 K would clip; ground reaches 151–313 K), and the time slider covers the whole sol in 48 steps.
- **Dust Devil #84** (the prototype's moving fake dust devil) is replaced by the pipeline's heating index map.
- **Landmark labels** also give way when they would overlap a higher-priority label, since real sites can be a few hundred metres apart.
