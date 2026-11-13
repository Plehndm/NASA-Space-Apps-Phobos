# Mars Navigator: demo video script (about 2 min 45 s)

Team Phobos · NASA Space Apps 2026 · "Interplanetary Survival Guide: Martian Map"

Two sources of footage:

- **Web:** a screen recording of the web build in a desktop browser at about 1440 × 900. Use the hosted demo, <https://plehndm.github.io/NASA-Space-Apps-Phobos/>, or a local run (`npx expo start` in `app/`, then <http://localhost:8081>). The links below use the hosted demo; on a local run, swap the start for `http://localhost:8081/`.
- **Phone:** the same app in Expo Go (`npx expo start` in `app/`, scan the QR code; see `app/README.md`, "Run it locally"). Record with the phone's own screen recorder, or film the phone in hand for shots 2 and 8.

`?scene=<name>` jumps the app into a prepared state (`app/README.md`, "Demo scenes"). Scenes marked * wait for the map data, so give them a second or two before you start talking. Open each link in a fresh tab. To get a scene on the phone, restart the dev server with `EXPO_PUBLIC_SCENE=<name> npx expo start` (PowerShell: `$env:EXPO_PUBLIC_SCENE='<name>'; npx expo start`).

Before recording: check that the map shows satellite imagery around Bradbury Landing and the header reads "Sol 742". If the map is empty ("MAP DATA OFFLINE"), the map data isn't loaded. Open the assistant and check its status line: "LIVE MODEL" means the Claude-backed assistant is on; "OFFLINE ASSISTANT" means it answers from the app's own data (still fine to film).

| # | Time | Source | Open | Do | Say |
| --- | --- | --- | --- | --- | --- |
| 1 | 0:00–0:12 (12 s) | Web | `?device=desktop&scene=home` | Hold on the map, then scroll-zoom out slowly toward Mount Sharp. | "This is Mars Navigator: Google Maps for a rover crew in Gale Crater, where Curiosity landed. Everything on this map is real NASA data." |
| 2 | 0:12–0:30 (18 s) | Phone | Home (no scene) | Drag the map, pinch to zoom, tap the ground to show the coordinate pill (latitude, longitude, elevation, slope). Then pull up the sheet. | "The base map is the Mars Reconnaissance Orbiter's CTX mosaic. Elevation and slope come from stereo terrain models. The Home card gives modelled ground temperature, dust opacity measured by Curiosity's Mastcam, and the nearest dust-devil hot spot." |
| 3 | 0:30–0:50 (20 s) | Web | `?device=desktop&scene=layers` | Press play on the time slider so the temperature map runs through the sol. Switch GROUND to AIR, then tap MODEL LIMITS. | "Temperature comes from our own model, driven by THEMIS thermal inertia and fitted to Curiosity's weather station: five seasons, a whole sol. And we say what it can't do: it's only checked near the rover." |
| 4 | 0:50–1:05 (15 s) | Web | `?device=desktop&scene=search` | Show the category chips and the results, nearest first. Type `4.6S 137.4E` and press Enter to jump there. | "Search covers 19 landmarks in seven categories, sorted by distance, and takes raw coordinates too." |
| 5 | 1:05–1:25 (20 s) | Web | `?device=desktop&scene=waypoint` * | Point at the two route cards, click Route #1 then Route #2 (the line on the map changes), then point at the elevation profile. | "Pick a target and the app plans two routes on the real terrain: a direct one, and a safe one that keeps under the rover's grade limit and around every hazard zone. The profile shows the climb." |
| 6 | 1:25–1:45 (20 s) | Web | same tab, eye button on the Waypoint card | Click the eye button. Drag to look around, then click a walking arrow to step to Point Lake at Yellowknife Bay. Back to map. | "Street Level drops you into a real Curiosity panorama at that spot. The arrows walk you to the next one." |
| 7 | 1:45–2:00 (15 s) | Web | `?device=desktop&scene=route` * | Show the three stops; move one with the up and down arrows; hover NAVIGATE. | "Chain stops into a multi-stop trip. Each leg shows its distance and time, and the button carries the totals." |
| 8 | 2:00–2:20 (20 s) | Phone | `nav` scene (`EXPO_PUBLIC_SCENE=nav`) * | Let the rover drive for a few seconds; point at the ETA card and the moving marker on the grade profile. | "Hit navigate and the rover drives the route in simulation, sped up 60 times: arrival time, the leg, a hazard scan, and where you are on the climb." |
| 9 | 2:20–2:35 (15 s) | Web | `?device=desktop&scene=assistant` * | Let the answer show, then click LOAD ROUTE; the stops appear in the sequence on the map. | "The route assistant answers from the app's own sector data. Ask for a science day clear of dust devils and it proposes a route you can load in one click." |
| 10 | 2:35–2:45 (10 s) | Web | `?device=desktop&scene=about` | Scroll slowly through the data credits. | "Built by Team Phobos on NASA data: CTX, THEMIS, TES, REMS, Mastcam and Curiosity's panoramas. Mars Navigator." |

Total: about 2 min 45 s. To cut to about 2 min, drop shots 4 and 7.

## Notes for the recording

- Turn off browser extensions and bookmarks bars; record the browser window only. The desktop layout needs a window at least 900 px wide.
- On the phone, turn on Do Not Disturb. In Expo Go, shake the phone and close the dev menu if it opens.
- Every claim above matches what the app does today (`app/README.md`, "What's built"). Don't say the assistant calls Claude live: the live backend is built but switched off, and the demo uses the offline answers. The habitats, relays, landing pads and checkpoints are invented sites placed on real ground; the named science sites (Rocknest, Yellowknife Bay, Pahrump Hills and others) are real.
- Still screenshots of every scene, phone and desktop, are in `docs/screenshots/`.
