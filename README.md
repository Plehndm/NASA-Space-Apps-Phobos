# NASA-Space-Apps-Phobos: Mars Navigator

Team Phobos's entry for NASA Space Apps 2026, challenge **"Interplanetary Survival Guide: Martian Map"**.

## The goal

**Mars Navigator** is a Google-Maps-style navigation app for crews driving a rover in **Gale Crater** (Curiosity's landing site, with Mount Sharp at the centre). It combines real NASA orbital and rover data into one map:

- **Base map and terrain:** CTX imagery, elevation and slope from stereo DTMs.
- **Environment layers:** modelled ground and air temperature through the day, plus a dust-devil likelihood layer.
- **Hazard-aware routing:** two route options (direct vs. safe), multi-stop trips, and a simulated drive with live ETA and grade profile.
- **Street Level:** walk-around rover panoramas at key waypoints.
- **Route assistant:** a Claude-powered chat that suggests and loads routes.

Status: the **data pipeline** and the **UI design** exist. The **app foundation** is in `app/`: layout, theme, header, dock, settings. Every screen and map layer is still a placeholder. The design is an HTML prototype that uses fake terrain. The work left is to build the features and connect them to the real data.

## Where everything is

```text
NASA-Space-Apps-Phobos/
├── .github/workflows/           claim-checklist.yml: fills in names on the checklist issue
├── README.md                    this file: overview + link to the feature checklist
├── mars-navigator.pptx          presentation deck (exported from the design deck)
│
├── app/                         THE APP (React Native + Expo: phone via Expo Go, desktop via web); start in app/README.md
│   ├── src/shell/               header, dock, bottom sheet / side panel, settings, toasts
│   ├── src/cards/               one screen per sheet mode (placeholders until built)
│   └── assets/map/              map images (copied from the design for now)
│
├── Mars Navigator App Design/   UI DESIGN (reference only, not production code)
│   ├── README.md                full design spec: tokens, layouts, screens, behaviour, state
│   ├── design/
│   │   ├── Mars Navigator v2.dc.html       interactive prototype (phone); open in a browser
│   │   ├── Mars Navigator Desktop.dc.html  same app, desktop layout
│   │   ├── Mars Navigator Deck.dc.html     10-slide demo deck
│   │   └── assets/              base map, elevation strata, 21 heat frames used by the prototype
│   └── data/                    heat-frame manifest + design brief from the data team
│
├── MarsDataPipline/             DATA + SCIENCE (Python / Jupyter)
│   ├── README.md                start here: results, how to run, notebook order
│   ├── CLAUDE.md                rules + physics spec; read before changing code
│   ├── thermal1d.py             1D soil heat model (physics baseline)
│   ├── residual.py              corrections fitted to Curiosity REMS readings
│   ├── map_export.py            builds the full-crater temperature maps
│   ├── notebooks/               temperature-model notebooks, in build order
│   ├── data_prep/               raw data -> processed data
│   ├── gale_tiles/              map tiles (imagery, topo) + 20 m DEM; has its own README
│   ├── dust_devil/              dust-devil likelihood layer (parked); has its own README
│   ├── processed_data/Google_Drive   link to the shared Drive with all big data files
│   ├── raw_data/Citations       data and paper references
│   └── docs/                    plan, progress log, findings, rejected ideas
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
