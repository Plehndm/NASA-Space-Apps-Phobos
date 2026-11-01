# Handoff: Mars Navigator (Gale Crater rover navigation)

> **This folder is the design reference, not the application.**
> The real app is in [`../app/`](../app/README.md) (React Native + Expo), and all feature work happens there. Use the files here to see how each screen should look and behave, then rebuild it in `app/`. Don't edit these files to change the product, and don't import from them.

Surface navigation app for crews in Gale Crater: a map with elevation, THEMIS ground-temperature and hazard layers; landmark search; two-option slope-aware routing; multi-stop sequences; a simulated expedition with live ETA and grade profile; and a Claude-powered route assistant. Phone (393×852) and desktop (1440×900) layouts share one component.

Companion repo: `Plehndm/NASA-Space-Apps-Phobos` (branch `main`, folder `MarsDataPipline/`) holds the data pipeline (thermal model, Gale tiles, dust-devil layer). This bundle holds the UI.

## About the design files

Everything under `design/` is a **design reference built in HTML**. It is an interactive prototype that shows the intended look and behavior; it is not production code to ship. The task is to **recreate these screens in the target codebase** (React/Next, SwiftUI, Flutter, etc.) using its own patterns. The target codebase is `../app/` (React Native + Expo).

The prototype runs as-is: open `design/Mars Navigator v2.dc.html` (phone) or `design/Mars Navigator Desktop.dc.html` (desktop) in a browser. `support.js` is the small runtime that renders the template; `deck-stage.js` is only for the slide deck; `image-slot.js` is a drop-target placeholder used on the Street Level screen.

## Fidelity

**High-fidelity.** Colors, type, spacing, radii and copy are final. Recreate pixel-accurately. The business logic in the prototype (routing, DEM, simulation) is faithful in behavior but uses a synthetic terrain model; the real DEM comes from the data pipeline.

## Source layout inside the prototype

`Mars Navigator v2.dc.html` is one file with two halves:

- **Template** (inside `<x-dc>`): plain HTML with inline styles and `{{ name }}` holes. `<sc-if value>` = conditional, `<sc-for list as>` = loop. Every visible element lives here.
- **Logic** (`class Component extends DCLogic`, in the `<script data-dc-script>` tag): React-class-style state and a `renderVals()` that returns every value the template reads. All the sections below cite method names from this class.

`Mars Navigator Desktop.dc.html` just mounts the same component with `device="desktop"`. `Mars Navigator Deck.dc.html` is a 10-slide presentation that embeds the live component in each state.

## Design tokens

Declared as CSS custom properties on the root element of the template (copy them verbatim).

Colors
- `--bg0 #140b09` page / street-view ground
- `--bg1 #1b100d` app ground, header, map letterbox (`--bg1-rgb 27,16,13`)
- `--bg2 #231512` sheet / panel surface (`--bg2-rgb 35,21,18`), `--sheet rgba(35,21,18,.94)`
- `--row #2e1e19` list rows, inputs, segmented-control tracks (`--row-rgb 46,30,25`)
- `--card #36251f` cards
- `--raised #47322a` secondary buttons, badges, chips (`--raised-rgb 71,50,42`)
- `--line #5e4537` switch-off track, drag handle, inactive chip border
- `--hair rgba(255,216,190,.08)` dividers
- Text: `--fg #f8ece4`, `--fg2 #dcb9a6` (secondary), `--fg3 #ab8878` (tertiary, placeholders)
- Accent (route, toggles-on, assistant): `--accent #7fd4c1` (`--accent-rgb 127,212,193`), `--accent2 #cdf3ea` (light accent text), `--accent-ink #0d2a24` (text on accent). `--route`/`--route2`/`--route-ink` are aliases of the same three.
- CTA (Navigate, Add Stop, Load Route, hazard toggle on): `--cta #ec7a56` (`--cta-rgb 236,122,86`), hover `--cta-hover #f78d6b`, text `--cta-ink #2b0d04`
- Warm (labels, steep segments, landing points): `--warm #ffc394` (`--warm-rgb 255,195,148`), `--warm2 #f2b98f`, `--warm3 #ffe3cc`
- Danger: `--danger #ff6b5e`, `--danger-bg rgba(255,107,94,.12)`, `--danger-bd rgba(255,107,94,.35)`, `--danger-deep #9b2418` (END button)
- Hazard colors (fixed per type): dust devil `#d946ef`, steep `#ef4444`, rough `#f4baa0`, radiation `#c5c6ff`, sand `#ffb4a5`
- Elevation strata chips: L1 `#e0bfb8`, L2 `#2eb21e`, L3 `#4c4eff`; strata gradient `#0e0cca → #2db11c → #4a3401`
- Heat legend (plasma, kelvin): `#0d0887,#46039f,#7201a8,#9c179e,#bd3786,#d8576b,#ed7953,#fb9f3a,#f0f921`

Typography: Plus Jakarta Sans (Google Fonts), weights 400–800, `font-variant-numeric: tabular-nums` on body. Scale: 22px/700/-0.5px section titles; 20–26px/700 hero numbers; 15px/700 header title; 14px/600 row titles and inputs; 13px/500 body; 12px/500 notes; 10.5–11px/500–700 metadata; 9–10px/600–700 uppercase labels with 0.6–1.2px tracking.

Radii: sheet `--r-sheet 34px` (top corners on phone); cards 22px; "pebble" hero cards `--r-pebble 30px 24px 28px 18px / 28px 22px 30px 20px` and `--r-pebble2 18px 28px 24px 30px / 20px 30px 22px 28px` (alternate between consecutive cards); rows and most buttons `999px`; inner tiles 18px; chat bubbles `20px 20px 6px 20px` (user) / `20px 20px 20px 6px` (assistant).

Shadows: `--shadow1 0 8px 20px rgba(10,4,2,.4)`, `--shadow2 0 14px 36px rgba(10,4,2,.5)`, sheet `0 -18px 50px rgba(10,4,2,.5), inset 0 1px 0 rgba(255,216,190,.08)`, CTA glow `0 10px 26px rgba(236,122,86,.35)`. Blur for translucent surfaces: 28px.

Spacing: 16px panel padding, 10px gap between stacked cards, 14–16px card padding, 8px between sibling buttons, 6px between chips. Hit targets ≥ 44px for primary controls (dock buttons 44, Navigate 50–54, END 42).

Map tint: the CTX base image gets `filter: sepia(.5) saturate(1.3) contrast(1.02) brightness(.88) hue-rotate(-8deg)` plus a top haze `linear-gradient(180deg, rgba(255,172,122,.2), transparent 32%)`.

## Layouts

### Phone (393×852)
- Map fills the whole frame underneath everything.
- Header 64px, translucent (`rgba(27,16,13,.94)→.62`, blur 18px): left "Gale Crater" 15/700 over "Sol 742 · HH:MM:SS MTC" 11/500 `--fg2`; right a status pill ("OFFLINE MAPS ✓", or "DEMO ×60" in `--warm` while navigating) and a 36px round gear button.
- Right dock (top 80, right 12, 10px gap): 44px circles — Layers, Hazards (with 10px status dot), HM (heatmap), ✦ Assistant, then a 44×80 zoom pill (+/−). Active state: `--cta` fill with `--cta-ink` glyph.
- Bottom sheet with three snap points: `peek` top=400, `half` top=250, `full` top=76. Drag handle 44×5 `--line`. Transition `top .35s cubic-bezier(.2,.8,.2,1)`. The map dims under the sheet with a `#140b09` scrim whose opacity goes 0→0.5 as the sheet rises from 400 to 76.
- Pinned under the handle: (ETA card when navigating) then the search bar; the card stack scrolls below.
- Bottom-left of the map, above the sheet: recenter FAB (44px circle, `--accent2` crosshair) at left 12; scale bar at left 68; heat legend above the scale bar.
- Top overlays (top 76): hazard banner (left 12, when hazard style = banner), coordinate pill (center), toast (left 16 → right 16).

### Desktop (1440×900)
- Fixed left panel 420px, `--bg2`, shadow `12px 0 40px rgba(10,4,2,.45)`: header 72px (opaque `--bg2`), then the same search bar and card stack, scrollable. No drag handle, no snap points, no scrim.
- Map occupies x 420→1440. Dock at top 16 / right 12, overlays at top 16, recenter FAB bottom-left (left 16, bottom 16), scale at left 72, legend above it.
- Settings opens as a centered 480px dialog (radius 34, `--shadow2`) over a `rgba(20,11,9,.55)` blur-4px backdrop. Street Level covers only the map area.
- Initial view: scale 2.1, translate (−28, −298). Phone initial view: scale 1.3, translate (−116, −284).

## Map

World space is 512×683 px (one CSS px = 100 m; `km(px) = px*0.1`). All layers, markers and routes are positioned in world space inside one transformed container (`translate(tx,ty) scale(s)`); markers and pills counter-scale by `1/s` so they stay a constant screen size. Zoom range 0.7–4.2.

Layers (all 512×683, aligned to the base):
- `assets/world.png` base (always on, tinted as above)
- `assets/elev-l1/2/3.png` elevation strata at opacity .74, one at a time
- `assets/heat/ltst_HHMM.jpg` 21 THEMIS ground-temperature frames, 01:30→11:30 LTST in 30-min steps, placed at world (63, 240) size 458×445, opacity .62, with a soft radial alpha mask at the edges. Temperature is in kelvin on one shared plasma scale; legend endpoints are `legendMinK`/`legendMaxK` (default 180–280 K, provisional until the data team confirms). Credit "THEMIS/TES, NASA/JPL-Caltech/ASU".
- Grid: lines every 64 world px, `--warm3` at 7% opacity.
- Hazard zones: ellipses `(x, y, rx, ry, rotation)` filled 13% + 2.2px dotted stroke (`stroke-dasharray 1 7`, round caps) in the type color, each with an uppercase label pill above it. Dust Devil #84 moves (vx 0.012, vy 0.03 px/tick, resets at y>360 or x>330).
- Routes: dark casing (`--bg1` 60%, 7.5px) under a 3.5px `--route` line; segments steeper than 12° drawn again in `--warm`; traversed part at 28% `--route2`; alternative route as 2px `--fg3` dots. Midpoint pills: active route "time · distance" (`--route` fill); alternative "time · safe|direct" (dark pill, tap to switch).
- Markers: 14px dot (`--route2`, landing points `--warm`) with a 3px `--bg1` ring; label pill 10.5/700 uppercase 0.7px tracking on a 16px stem. Label visibility by rank: rank 1 always, rank 2 at s ≥ 1.7, rank 3 at s ≥ 2.4, plus always when selected / in the sequence / matching a search. Selected = `--route` fill, `--route-ink` text. Sequence members show a numbered badge.
- Rover: `--warm` arrow rotated to heading, 40px pulsing ring (`mn-pulse` 2.4s), and an 88px heading cone (radial gradient `--route` 45%→0).

Gestures: one-finger pan, two-finger pinch (pointer events), wheel zoom around the cursor, tap on empty map shows a coordinate pill ("4.59°S 137.44°E · −4,501 m · 4° slope") for 2.6s. Interactive controls carry `data-nopan` so they do not start a pan.

## Screens (card stack states)

The sheet/panel shows one of these `mode`s: `home`, `search`, `waypoint`, `route`, `nav`, `arrived`, `layers`, `assistant`. Exact copy is in the template; summary below.

1. **Home** — Sector card (`rgba(46,30,25,.92)` pebble): title "Gale Crater" 22/700 + rover coordinates + crosshair (tap recenters); 3 tiles (18px radius, `--card`): SURFACE TEMP "-64°C 209 K" (`--warm3`), DUST OPACITY "τ 0.32 LOW" (`--accent2`), GROUND SLOPE "x.x° NOMINAL/MODERATE/STEEP" (`--warm2`). Advisory row (pill, dark, border `--warm` 40% when < 5 km): triangle icon in `#d946ef`, "Dust Devil Alert (Track #84)", "Moving SSE at 18 km/h • N km clear of route", badge SAFE/WATCH. "NEARBY LANDMARKS" label + 3 nearest rows.
2. **Search** — horizontal category chips (All, Traverse, Water-Ice, Habitats, Geological, Craters, Relays, Landing) with count or 2-letter code badge; "RESULTS"/"RECENT SEARCHES" label with "Clear History" or "N SHOWN"/"TAP TO ADD STOP"; result rows (38px code circle, name 14/600, "x km away · y min", tag NAV READY `--warm` or HAZARD `--danger`). Enter selects the nearest match; Escape leaves search.
3. **Waypoint** — hero pebble card with two decorative circles (`--cta` 14%, `--warm` 6%): TARGET label, name 22/700, meta "CATEGORY · lat lon · elev", right column ESTIMATED TRANSIT + "x km · max y° · via n stops". Description 13/500, assistant note bubble (`--accent` 9%). Then either **No safe route** block (`--danger-bg`, "NO SAFE ROUTE FOUND", reason, buttons "Nearest safe approach"/"Nearest reachable point" and "Override at risk"/"Override grade limit") or: route pickers ROUTE #1 · DIRECT / ROUTE #2 · SAFE (selected = `--accent` 10% fill + 1.5px `--accent` border), Elevation profile (300×44 sparkline, gradient fill, steep parts `--warm` 3px, start/end elevation labels, "ROVER LIMIT 18° · DIRECT 25° · PEACH = GRADE OVER 12°"), action row: "Add stop" (raised pill 50px), eye button (Street Level), NAVIGATE (CTA, 50px, 17/800, arrow icon).
4. **Sequence (route)** — "Sequence" title + "N STOPS" badge + "Add Stop" CTA (36px); rows: 01 Rover position START, then numbered stops with "+x km (y min) • lat lon" and ↑ ↓ × buttons (28px circles); optional danger row "ROUTE #1 CROSSES …" with USE ROUTE #2; "NAVIGATE (1 h 20 min · 12.3 km · MAX 9°)" 54px CTA; "CLEAR SEQUENCE" text button.
5. **Expedition (nav)** — ETA card pinned above search (24px radius `--card`): ARRIVAL · MTC 26/700, TIME LEFT 16/700 `--accent2`, DISTANCE 16/700. Optional danger warning row (with REROUTE) or accent "MANUAL REROUTE · tap the map to place a via-point" row (with CANCEL). Progress card (stepped): EXPEDITION PROGRESS + %, "Leg i of n: Target" 20/700, per-leg 8px bars (flex ∝ leg length, `--accent` fill), tiles TARGET WAYPOINT ("x km (y min) · max z°") and HAZARD RADAR SCAN (name + "x km clear", `--danger` under 2.5 km), grade map (full-route sparkline, traversed part dimmed 45%, 2px `--warm3` position line + 12px dot, "YOU · x km of y km · elev" and end label), note bubble, buttons ADD STOP / REROUTE (toggle, `--accent` border when armed) / END (`--danger-deep`, 68px). Compact variant: 46px ring (dasharray 113) + target + leg/remaining + hazard, END, then ADD STOP / REROUTE row.
6. **Arrived** — row card with check circle, landmark name uppercase `--accent2`, "Arrived at Destination" 15/700, "x km · y min · n stops", DONE.
7. **Layers** (when layer picker = panel) — "Layers" + DONE; cards: ELEVATION STRATA (OFF/L1/L2/L3 chips, strata gradient, "-4.5 km floor / +0.7 km summit"), GROUND TEMPERATURE (switch, LTST slider 01:30–11:30 with play/pause, plasma bar with 5 kelvin ticks, "Kelvin · one scale shared by all 21 frames"), WARNING ZONES (switch, 5 hazard chips: Rough terrain, Steep slopes, Dust devils, Radiation, Sand traps), LANDING POINTS switch + SATELLITE IMAGERY "MRO CTX mosaic · 6 m/px · always on" BASE badge. When layer picker = dock, the same controls appear as popovers beside the dock buttons (elevation: vertical legend + L1/L2/L3 pills; heat: 176px card with switch, time slider, play, legend).
8. **Route assistant** — "✦ Route assistant" 22/700 + round 36px × close button; status line "LIVE MODEL · …" or "SCRIPTED FALLBACK · live model unavailable"; chat bubbles 13/500 (user `--raised`, assistant `--card`); PROPOSED ROUTE card (numbered rows, "+x km", "AVOIDS · …", LOAD ROUTE CTA 44px); busy pill "✦ checking telemetry and hazard tracks…"; TRY suggestions (3 bubbles); input row sticky at the bottom (48px pill input + 48px `--accent` send circle; the row has no background of its own, only `backdrop-filter: blur(12px)` with a mask fade).
9. **Street Level** (full-screen on phone, map-area on desktop) — 64px header (back circle, "STREET LEVEL" / landmark name, "MASTCAM-Z · SOL 740" badge), panorama drop slot with compass strip N…NW and a center bearing line, HDG and coordinate pills, bottom sheet with description and "Back to map" / "Navigate here".
10. **Settings** — gear in header opens it. Groups MAP (Layer controls DOCK/PANEL, Hazard alerts ADVISORY CARD/TOP BANNER), NAVIGATION (Progress card STEPPED/COMPACT, Rover grade limit slider 8–30°, Demo speed slider 10–240×), SEARCH (Category chips COUNTS/ICONS), ASSISTANT (Inline notes switch), "RESET TO DEFAULTS". Segmented controls: `--row` track, 3px padding, selected segment `--fg` fill with `--raised` text. Switches 44×24, knob 20px, on = `--accent` (hazard toggle uses `--cta`).

Hazard style = banner replaces the home advisory with a top-left pill "DUST DEVIL #84 · 3.2 KM · MOVING SSE AT 18 KM/H" with a blinking dot in the hazard color.

## Interactions & behavior

- Selecting a landmark (marker tap, search row, Enter) → `waypoint`, centers the map on it (450ms ease), adds it to recents (max 4). If a sequence already exists and you select from search, the landmark is appended to the sequence instead.
- Route #1 (direct, grade cap 25°) vs Route #2 (safe, cap = grade limit setting, default 18°, avoids every enabled hazard zone). Default is #2; falls back to #1 if #2 has no path. "Override at risk" lifts both caps to 45° for that target only.
- NAVIGATE → `nav`. Simulation tick every 100 ms: speed by grade (≤8° 8 km/h, ≤15° 5, ≤20° 3, else 2) × demo speed; rover heading follows the path. Toast on each reached stop; auto-ends at destination → `arrived`.
- REROUTE arms via-point mode; the next map tap inserts a via and rebuilds the remaining legs. Warnings ("ROUTE AHEAD CROSSES …") offer an automatic safe reroute.
- Hazard dock button toggles all zones; chips filter by type. Dust devil track animates continuously.
- Heat: switch on loads all 21 frames; the slider scrubs LTST; play cycles frames every 380 ms. Legend hides while the heat popover is open.
- Toasts: 3.2 s default, top overlay, blinking `--accent` dot.
- Assistant: `window.claude.complete` with a system prompt listing every landmark (distance, elevation, slope, reachability and safe-route time), every hazard (distance, detail, filter state) and the telemetry; the model must answer with JSON `{reply, route[], avoid[]}`. On failure a scripted fallback answers by keyword (hazard / science plan / weather / named landmark). Replies with a non-empty `route` render the PROPOSED ROUTE card; LOAD ROUTE sets the sequence and switches to `route`.
- Scene prop (`home|layers|search|waypoint|route|nav|assistant|settings`) jumps the app into a demo state on mount; used by the deck.

## State

`mode`, `sel` (landmark id), `stops[]`, `routeOpt` (1|2), `override`, `q`, `cat`, `recent[]`, `sheetY`, `drag`, map `s/tx/ty/anim`, `elev` (0–3), `elevOpen`, `heat` (off|on), `heatT` (0–20), `heatPlay`, `heatOpen`, `hazOn`, `hazTypes{weather,steep,rough,radiation,sand}`, `lz`, `rover{x,y,h}`, `nav{stops,pts,legEnds,cum,prog,legIdx,startedAt,grade,spd}`, `arrived`, `toast`, `coord`, `clock`, `chat[]`, `chatIn`, `busy`, `street`, `viaPending`, `settingsOpen`, `settings{}` (in-app overrides of the props below).

Props / settings (defaults): `device` phone|desktop, `scene` home, `layerPicker` dock, `hazardStyle` advisory, `progressCard` stepped, `maxGrade` 18, `demoSpeed` 60, `chipStyle` counts, `inlineNotes` true, `legendMinK` 180, `legendMaxK` 280.

Routing internals worth porting: A* on a 4-px grid over the DEM with a tangent grade cap and cost `d·(1+3·(grade/cap)²)`, then line-of-sight smoothing; hazard ellipses as blocked cells (inflated ×1.06); results memoized by (stops, safe, rover position, hazard filters, caps, dust-devil position).

## Data

- Landmarks (19) and hazard zones (5) are literal arrays `this.LM` / `this.HZ` at the top of the logic class: id, name, category, world x/y, stratum, elevation, description, assistant note.
- World→lat/lon: `lat = -4.5895 + (y-356)·0.1/59.3`, `lon = 137.4417 + (x-214)·0.1/59.1`.
- Terrain `E(x,y)` is synthetic (Mount Sharp mound, rim ring, Peace Vallis fan, noise); replace with the pipeline DEM (`MarsDataPipline/`), 1 world px = 100 m, slopes computed at 250 m/px.
- Heat frames: `data/manifest.json` and `data/DESIGN_BRIEF.md` describe the THEMIS frames and their bounds. Frames here are the pipeline's PNGs recompressed to JPEG with no-data speckles filled.

## Assets

`design/assets/world.png` (CTX mosaic crop, 512×683), `elev-l1/2/3.png` (strata overlays), `heat/ltst_0130…1130.jpg` (21 frames). Fonts: Plus Jakarta Sans via Google Fonts. Icons are inline SVG paths in the template (layers, hazard triangle, filter, search, crosshair, eye, arrows, gear, ×). No raster icons.

## Files

- `design/Mars Navigator v2.dc.html` — the app (phone layout by default; `device="desktop"` prop for desktop)
- `design/Mars Navigator Desktop.dc.html` — desktop mount
- `design/Mars Navigator Deck.dc.html` + `deck-stage.js` — presentation (also exported as `mars-navigator.pptx` in the parent project)
- `design/support.js`, `design/image-slot.js` — prototype runtime, not for porting
- `data/manifest.json`, `data/DESIGN_BRIEF.md` — heat-frame metadata from the data team
