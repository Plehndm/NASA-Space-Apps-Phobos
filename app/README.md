# Mars Navigator app

React Native + Expo (SDK 58) + TypeScript. One codebase runs on phones through **Expo Go** and on desktop in a **web browser**. It is built from the HTML prototype in `../Mars Navigator App Design/`; read that folder's README for the exact look and behaviour of every screen.

## Run it

```bash
cd app
npm install
npx expo start
```

`npx expo start` prints a QR code and waits. Every save reloads on all connected devices.

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

### If the phone can't connect

- **Campus or public Wi-Fi** (eduroam, cafés) often blocks devices from reaching each other. Run `npx expo start --tunnel` instead. It works over the internet; the first time, it asks to install `@expo/ngrok`, so answer yes. Or connect the computer to the phone's hotspot.
- **Windows firewall:** if Windows asks whether Node.js may use the network, allow **Private networks**. Then set your Wi-Fi to Private: Settings → Network & internet → Wi-Fi → your network → Network profile type → Private.
- **"Project is incompatible with this version of Expo Go":** update Expo Go from the app store.

### Checks before you push

```bash
npm run typecheck        # TypeScript
npm run doctor           # Expo dependency and config checks
```

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

## Where your feature goes

```text
src/
├── App.tsx                fonts, safe areas, status bar
├── theme.ts               design tokens
├── assets.ts              every image (map, elevation strata, 21 heat frames)
├── state/store.tsx        app state + actions: useApp()
├── state/settings.ts      Settings type and defaults
├── state/clock.ts         MTC clock (useMtcClock, mtcSeconds, fmtClock)
├── layout/geometry.ts     frame size, panel width, safe areas, sheet snap points
├── ui/                    shared pieces: T (text), Card, SectionLabel, Segmented, Switch, BlinkDot, icons
├── shell/                 header, dock, sheet, search bar, toast, settings, map area
├── layers/DockPopovers.tsx  STUB: elevation + heat popovers beside the dock
└── cards/CardStack.tsx    one entry per sheet mode; each is a placeholder until built
```

- **A sheet screen** (Home, Search, Waypoint, Sequence, Expedition, Arrived, Layers, Assistant): create `src/cards/<Name>.tsx`, then replace its `<Placeholder>` entry in `src/cards/CardStack.tsx`.
- **A map layer:** add it inside the world container (`Animated.View`) in `src/shell/MapArea.tsx`. World space is 512×683 px, and one world px is 100 m. Position everything absolutely in world px; the container applies the pan/zoom transform. Use `react-native-svg` for shapes and routes.
- **Map engine:** `MapArea.tsx` currently draws only the base image, plus the `view` transform from the store (`{s, tx, ty}`, zoom 0.7–4.2). Pan, pinch, the coordinate pill, scale bar and recenter button are still to do. `PanResponder` handles one-finger pan and two-finger pinch in Expo Go. `useApp().zoomBy(k, x, y)` already zooms around a point.
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

## Differences from the HTML prototype

React Native can't do everything CSS does. These are the deliberate differences:

- **Map tint:** the CSS `filter` tint is baked into `assets/map/world-tinted.png`. If the base map changes, re-run `python scripts/tint_map.py assets/map/world.png assets/map/world-tinted.png`.
- **"Pebble" corners:** these are elliptical in CSS. Here each corner is circular, using the average of its two radii.
- **Backdrop blur:** the frosted blur behind the header, sheet and dialog is not used. The surfaces rely on the design's semi-transparent colours.
- **Assets** in `assets/map/` are copies of the prototype's images. Replace them with pipeline outputs as the data features land, and update `src/assets.ts`.
