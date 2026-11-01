# Mars Navigator app

React + TypeScript + Vite. This is the real app, built from the HTML prototype in `../Mars Navigator App Design/`. Read that folder's README for the exact look and behaviour of every screen.

## Run it

```bash
cd app
npm install
npm run dev          # desktop: http://localhost:5173
npm run build        # typecheck + production build into dist/
```

### Test on your phone

1. Run `npm run dev`. The terminal prints a QR code under the Local / Network addresses.
2. Make sure your phone is on the **same Wi-Fi** as the computer.
3. Scan the QR code with the phone's camera and open the link. Saved changes reload on the phone and the desktop at the same time.

If the phone can't load the page:

- **Windows firewall:** the first time, Windows asks whether Node.js may use the network. Allow it on **Private networks**. Then set the Wi-Fi connection itself to Private: Settings → Network & internet → Wi-Fi → your network → Network profile type → Private.
- **Campus or public Wi-Fi** (eduroam, cafés) often blocks devices from reaching each other. Use a phone hotspot instead: connect the computer to the phone's hotspot, restart `npm run dev`, and scan the new QR code.
- **No QR code printed:** the computer isn't on a network. Type the `Network:` address into the phone's browser by hand instead.

### What about Expo Go?

Expo Go can't open this app. Expo Go only runs **React Native** projects. This app is a **React web app** (HTML and CSS in the browser), so there is no Expo project for Expo Go to load. Scanning our QR code from inside Expo Go won't work either.

Use the phone's **camera app** or a **browser** to scan the QR code above. The result is the same as Expo Go: scan once, then every save reloads on the phone.

Running in Expo Go would mean rewriting every component in React Native. That is a separate decision for the team, not a setup step.

URL options:

| Option | Effect |
|---|---|
| `?device=phone` | Phone layout. On a wide screen it shows the prototype's 393×852 frame, for side-by-side comparison. |
| `?device=desktop` | Desktop layout |
| `?scene=settings` | Opens Settings on load |

Without `?device`, windows 900 px wide or wider get the desktop layout and narrower ones get the phone layout.

## What's built (checklist section 1: App foundation)

- **Design tokens + theme:** `src/styles/tokens.css` holds every colour, radius, shadow and font from the design README. Use the `var(--…)` names, never raw hex.
- **Layout shells:** `src/layout/geometry.ts` and `src/shell/Sheet.tsx`.
  - Phone: bottom sheet with peek / half / full snap points. Drag the handle, or tap it to step through the points. The map dims as the sheet rises.
  - Desktop: fixed 420 px left panel. Both layouts use the same components.
- **Header, dock, toasts:**
  - `Header.tsx`: Sol + ticking MTC clock, status pill, settings gear.
  - `Dock.tsx`: Layers, Hazards (with status dot), HM, ✦ Assistant, zoom.
  - `Toast.tsx`: transient messages, shown with `toast("…")`.
- **Settings dialog:** `src/shell/SettingsDialog.tsx`. Every setting from the prototype. Values are saved per browser.

## Where your feature goes

```
src/
├── state/store.tsx        app state + actions: useApp()
├── state/settings.ts      Settings type and defaults
├── state/clock.ts         MTC clock (useMtcClock, mtcSeconds, fmtClock)
├── layout/geometry.ts     frame size, panel width, sheet snap points
├── styles/                tokens.css, global.css
├── ui/                    shared pieces: Card, SectionLabel, Segmented, Switch, icons
├── shell/                 header, dock, sheet, search bar, toast, settings, map area
├── layers/DockPopovers.tsx  STUB: elevation + heat popovers beside the dock
└── cards/CardStack.tsx    one entry per sheet mode; each is a placeholder until built
```

- **A sheet screen** (Home, Search, Waypoint, Sequence, Expedition, Arrived, Layers, Assistant): create `src/cards/<Name>.tsx`, then replace its `<Placeholder>` entry in `src/cards/CardStack.tsx`.
- **A map layer:** add it inside the world container in `src/shell/MapArea.tsx`. World space is 512×683 px, and one world px is 100 m. Position everything in world px; the container applies the pan/zoom transform.
- **Map engine:** `MapArea.tsx` currently draws only the base image, plus the `view` transform from the store (`{s, tx, ty}`, zoom 0.7–4.2). Pan, pinch, wheel, the coordinate pill, scale bar and recenter button are still to do. `useApp().zoomBy(k, x, y)` already zooms around a point.
- **Dock popovers:** replace the stubs in `src/layers/DockPopovers.tsx`. The dock already opens and closes them.
- **Something pinned above the search bar** (the ETA card while navigating): pass it to `<Sheet pinned={…} />`.

## Using the store

```tsx
import { useApp } from "../state/store";

const { state, geo, settings, patch, setMode, snapTo, toast, zoomBy } = useApp();
setMode("waypoint", "half");   // switch the sheet screen and snap the phone sheet
patch({ hazOn: true });        // merge fields into state
toast("Navigation started");   // 3.2 s message
settings.maxGrade;             // resolved settings (defaults + user changes)
```

Add the fields your feature needs to `AppState` in `store.tsx`, with a default in `AppProvider`.

## Assets

`public/assets/` is a copy of the prototype's assets: base map, elevation strata and 21 heat frames. Replace them with pipeline outputs as the data features land.
