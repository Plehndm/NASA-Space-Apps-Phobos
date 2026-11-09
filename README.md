# NASA-Space-Apps-Phobos: Mars Navigator

Team Phobos's entry for NASA Space Apps 2026, challenge **"Interplanetary Survival Guide: Martian Map"**.

## The goal

**Mars Navigator** is a Google-Maps-style navigation app for crews driving a rover in **Gale Crater** (Curiosity's landing site, with Mount Sharp at the centre). It combines real NASA orbital and rover data into one map:

- **Base map and terrain:** CTX imagery, elevation and slope from stereo DTMs.
- **Environment layers:** modelled ground and air temperature through the day, plus a dust-devil likelihood layer.
- **Hazard-aware routing:** two route options (direct vs. safe), multi-stop trips, and a simulated drive with live ETA and grade profile.
- **Street Level:** walk-around rover panoramas at key waypoints.
- **Route assistant:** a Claude-powered chat that suggests and loads routes.

Status: the **data pipeline** and the **UI design** exist. In `app/`, the **app foundation** (layout, theme, header, dock, settings) and the **map** are built: pan / pinch / zoom over the real CTX imagery, with elevation strata, ground and air temperature, hazard zones, the dust-devil heating index and the landmarks, all from the pipeline's data. The sheet screens (Home, Search, Waypoint, routing, Assistant, Street Level) are still placeholders.

> **`app/` is the actual application. `Mars Navigator App Design/` is only the reference.**
> The design folder is an HTML mock-up with fake terrain. It shows what each screen should look like and how it should behave. Don't edit it or ship it, and don't import from it. Build features in `app/`, matching the design.

## Run the app and the design reference

You need [Node.js](https://nodejs.org) 22.13 or newer (24 LTS recommended), which Expo SDK 58 requires. Run everything from `app/`, in two terminals:

First time installation:
```bash
cd app
npm install              
```

To run the current app run the following in the `app/` directory:
```bash
npx expo start           # terminal 1: the app
npm run data             # terminal 2: the map data server
```

The map data (tiles, terrain, heat frames) is built from the pipeline outputs once; see "Map data" in [`app/README.md`](app/README.md).

To run the design reference execute the following in the `app/` directory:
```bash
npm run design           # terminal 3: the design reference (legacy HTML prototype)
```

| What | Desktop | Phone (same Wi-Fi) |
| --- | --- | --- |
| **The app** | Press **w** in terminal 1, or open <http://localhost:8081>. Add `?device=phone` for the phone layout. | Scan terminal 1's QR code with **Expo Go**: on Android in the app, on iPhone with the Camera. |
| **Design reference** | Open <http://localhost:8090> and pick Phone, Desktop or Slide deck. | Open the `Phone:` address that terminal 2 prints. |

**Checking your work:** put the app and the reference side by side at the same size. For example, the app at `?device=phone` next to the reference's Phone version. Compare layout, colours, spacing and copy, then click through the same steps in both and compare behaviour. The reference uses fake terrain and sample data, so match how it looks and behaves, not its numbers.

More detail, including campus Wi-Fi workarounds and where each feature goes: [`app/README.md`](app/README.md).

## Where everything is

```text
NASA-Space-Apps-Phobos/
├── .github/workflows/           claim-checklist.yml: fills in names on the checklist issue
├── README.md                    this file: overview + link to the feature checklist
├── mars-navigator.pptx          presentation deck (exported from the design deck)
│
├── app/                         THE APP (React Native + Expo: phone via Expo Go, desktop via web); start in app/README.md
│   ├── src/shell/               header, dock, bottom sheet / side panel, settings, toasts, map area
│   ├── src/map/                 coordinate system, map data loader, map layers, layer controls
│   ├── src/cards/               one screen per sheet mode (placeholders until built)
│   ├── scripts/                 fetch_imagery.py + build_map_data.py (pipeline outputs -> app data), data and design servers
│   └── data/                    built map data, served by `npm run data` (not tracked by git)
│
├── Mars Navigator App Design/   DESIGN REFERENCE ONLY, not the app: HTML mock-up to copy from
│   ├── README.md                full design spec: tokens, layouts, screens, behaviour, state
│   ├── design/
│   │   ├── Mars Navigator v2.dc.html       interactive prototype (phone); open in a browser
│   │   ├── Mars Navigator Desktop.dc.html  same app, desktop layout
│   │   ├── Mars Navigator Deck.dc.html     10-slide demo deck
│   │   └── assets/              base map, elevation strata, 21 heat frames used by the prototype
│   └── data/                    heat-frame manifest + design brief from the data team
│
├── MarsDataPipline/ DATA + SCIENCE (Python / Jupyter)
│ ├── README.md start here: results, how to run, notebook order
│ ├── CLAUDE.md rules + physics spec; read before changing code
│ ├── heatmap/ ground and air temperature maps
│ │ ├── thermal1d.py 1D soil heat model (physics baseline)
│ │ ├── residual.py corrections fitted to Curiosity REMS readings (ground and air)
│ │ ├── map_export.py builds and encodes the full-crater temperature maps
│ │ ├── paths.py every folder path the code uses
│ │ ├── pytest.ini test settings
│ │ ├── tests/ solver and forcing tests (Gates 1 and 2)
│ │ ├── notebooks/ temperature-model notebooks, in build order
│ │ ├── executed/ run copies of the notebooks with outputs (not in git)
│ │ └── outputs/ maps/ (deliverables) + model_scores/ (model tests) (not in git)
│ ├── dust_devil/ Dust Devil Heating Index layer (parked); has its own README
│ │ ├── dust_devil_pipeline.ipynb pipeline notebook
│ │ ├── dev/, tests/ iteration scripts and tests
│ │ ├── executed/ run copy of the notebook (not in git)
│ │ └── outputs/ per-sol maps, overlays, rover tables, CSVs, GIFs (not in git)
│ ├── data_prep/ raw data -> processed data
│ ├── gale_tiles/ map tiles (imagery, topo) + source DTMs; has its own README
│ ├── processed_data/ Google Drive link: model inputs, map tiles, heat-map outputs
│ ├── raw_data/ citation list: REMS, THEMIS, TES albedo, Mastcam tau (downloads not in git)
│ └── docs/ plan, progress log, findings, rejected ideas
│
├── mars_streetview/             STREET LEVEL PANORAMAS
│   ├── README.md                how to download, fill in and build the panoramas
│   ├── manifest.json            list of panoramas (some lat/lon/hfov/heading still empty)
│   ├── build_panos.py           NASA panorama -> tile pyramid + panos.json
│   ├── streetview.js            viewer glue (written for the Google Maps JS API)
│   └── raw/                     put downloaded source images here (not tracked by git)
│
└── phobos/                      local Python virtualenv (not tracked by git)
```

Large data files are not in git. They are on the shared Google Drive linked in `MarsDataPipline/processed_data/Google_Drive`.

## Feature checklist

**The checklist lives in [issue #3: Feature checklist](https://github.com/Plehndm/NASA-Space-Apps-Phobos/issues/3)**, where the boxes can be clicked.

- **Claim a feature:** tick its box. A bot (`.github/workflows/claim-checklist.yml`) puts your GitHub username next to it.
- **Give it up:** untick the box and it goes back to `unclaimed`.
- **Finish a feature:** edit the issue and change that line's 👤 to ✅.
- **Dependencies:** shown as a tree. An indented item depends on the item above it.

Areas covered: app foundation, map and layers, routing and navigation, search and home, route assistant, Street Level, science follow-ups, and submission.

## Credits

Imagery NASA/JPL-Caltech/MSSS · THEMIS/TES NASA/JPL-Caltech/ASU · USGS Astrogeology. Full references: `MarsDataPipline/raw_data/Citations`.

## License

See `LICENSE`.
