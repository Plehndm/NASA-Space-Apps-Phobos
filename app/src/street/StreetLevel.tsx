// Street Level (the design's full-screen view from the waypoint eye button): header with the camera
// and sol, the 360° panorama with compass strip and heading line, HDG and position pills, and a panel
// with the description, Back to map and Navigate here. Over the map area on desktop, the whole
// screen on a phone.
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useApp } from "../state/store";
import { alpha, C, R, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { distanceM, fmtLatLon } from "../map/geo";
import { LANDMARKS, type Landmark } from "../map/landmarks";
import { useRoutes } from "../route/RouteProvider";
import { PanoView, type ViewState } from "./PanoView";
import { azToStrip, STREET_RADIUS_KM, stripSpan, stripToAz, usePanos, type Pano } from "./panos";

/** The waypoint a panorama shows: the one it was opened from (if near), else its assigned one (any distance), else the nearest within the radius. */
function landmarkFor(p: Pano, from: string | null, extra: Landmark[]): { l: Landmark; km: number } | null {
  const all = [...LANDMARKS, ...extra.filter(l => !l.id.startsWith("via-"))].map(l => ({ l, km: distanceM(p, l) / 1000 }));
  const own = all.find(x => x.l.id === p.waypoint);
  const near = all.filter(x => x.km <= STREET_RADIUS_KM).sort((a, b) => a.km - b.km);
  return near.find(x => x.l.id === from) ?? own ?? near[0] ?? null;
}

export function StreetLevel() {
  const { state: S, geo, patch, toast } = useApp();
  const r = useRoutes();
  const panos = usePanos();
  const st = S.street;
  const pano = st && panos ? panos.byId[st.pano] : null;
  const [view, setView] = useState<ViewState>({ h: st?.heading ?? 0, p: 0, f: 70 });

  // A new panorama (opened, or walked to) faces the requested bearing (the centre of its imagery when
  // that bearing has none), level or a little down; the viewer then fits it to the imagery.
  useEffect(() => {
    if (!st || !pano) return;
    const h = azToStrip(pano, st.heading) ?? stripSpan(pano) / 2;
    setView({ h, p: Math.max(-12, pano.pitch), f: geo.device === "desktop" ? 90 : 70 });
  }, [st?.pano, !!pano]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => patch({ street: null });

  // Web: Escape closes, arrow keys look around, +/- zoom.
  useEffect(() => {
    if (Platform.OS !== "web" || !st) return;
    const onKey = (e: KeyboardEvent) => {
      const step = { ArrowLeft: [-10, 0, 1], ArrowRight: [10, 0, 1], ArrowUp: [0, 5, 1], ArrowDown: [0, -5, 1], "+": [0, 0, 0.85], "=": [0, 0, 0.85], "-": [0, 0, 1.18] }[e.key];
      if (e.key === "Escape") { patch({ street: null }); return; }
      if (!step) return;
      e.preventDefault();
      setView(v => ({ h: v.h + step[0], p: v.p + step[1], f: v.f * step[2] }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [st, patch]);

  if (!st) return null;
  // Still loading, or the panorama can't be found: say so instead of a blank screen.
  if (!pano || !panos) {
    return (
      <Shell>
        <Header title="Street Level" chip="" onBack={close} insetTop={geo.device === "desktop" ? 0 : geo.insetTop} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <T w={500} size={13} color={C.fg2} style={{ textAlign: "center" }}>
            {panos === undefined ? "Loading the rover panorama…" : "This panorama isn't available. Build the panoramas with mars_streetview/build_panos.py (see app/README.md)."}
          </T>
        </View>
      </Shell>
    );
  }

  const target = landmarkFor(pano, st.from, S.extraLm);
  const wide = pano.hfov >= 359 ? "360°" : `${Math.round(pano.hfov)}° wide`;
  const where = !target ? ""
    : target.km < 0.15 ? `at ${target.l.name}`
    : target.km > STREET_RADIUS_KM ? `${Math.round(target.km)} km away, looking toward ${target.l.name}`
    : `${target.km.toFixed(1)} km from ${target.l.name}`;
  const desc = `${pano.camera || "Rover"} panorama${pano.sol !== null ? `, sol ${pano.sol}` : ""}, ${wide}${where ? `, taken ${where}` : ""}.${target ? ` ${target.l.desc}` : ""}`;
  const chip = [pano.camera.toUpperCase(), pano.sol !== null ? `SOL ${pano.sol}` : ""].filter(Boolean).join(" · ");

  const navigate = () => {
    if (!target) return;
    patch({ street: null });
    r.startNav(target.l.id);
  };

  return (
    <Shell>
      <Header title={pano.title} chip={chip} onBack={close} insetTop={geo.device === "desktop" ? 0 : geo.insetTop} />
      <View style={{ flex: 1, minHeight: 0 }}>
        <PanoView
          pano={pano}
          panos={panos}
          view={view}
          onView={setView}
          onWalk={(id, heading) => patch({ street: { pano: id, heading, from: null } })}
        />
        <View pointerEvents="none" style={{ position: "absolute", left: 12, bottom: 36, flexDirection: "row", gap: 6, zIndex: 3 }}>
          <Pill color={C.accent2}>{`HDG ${String(Math.round(stripToAz(pano, view.h)) % 360).padStart(3, "0")}°`}</Pill>
          <Pill color={C.fg2}>{fmtLatLon(pano)}</Pill>
        </View>
      </View>
      <View style={{ marginTop: -24, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 22 + (geo.device === "desktop" ? 0 : geo.insetBottom), gap: 10, backgroundColor: C.bg2, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet }}>
        <T w={500} size={13} lh={1.5} color={C.fg2} numberOfLines={4}>{desc}</T>
        <T w={500} size={10} ls={0.3} color={C.fg3} numberOfLines={1}>{`IMAGERY: NASA/JPL-CALTECH/MSSS · ${pano.links.length ? "TAP AN ARROW TO WALK" : "NO NEIGHBOURING PANORAMA WITHIN 5 KM"}`}</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={close} style={{ flex: 1, height: 46, borderRadius: 999, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}>
            <T w={600} size={14}>Back to map</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={target ? `Navigate to ${target.l.name}` : "Navigate here"}
            accessibilityState={{ disabled: !target }}
            onPress={target ? navigate : () => toast(`No waypoint within ${STREET_RADIUS_KM} km of this panorama`)}
            style={({ pressed }) => ({
              flex: 1, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center",
              backgroundColor: pressed ? C.ctaHover : C.cta, boxShadow: SHADOW.glow, opacity: target ? 1 : 0.5,
            })}
          >
            <T w={800} size={15} color={C.ctaInk}>Navigate here</T>
          </Pressable>
        </View>
      </View>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { geo } = useApp();
  return (
    <View
      accessibilityLabel="Street level"
      style={{ position: "absolute", left: geo.mapLeft, top: 0, width: geo.W - geo.mapLeft, height: geo.H, zIndex: 8, backgroundColor: C.bg0, flexDirection: "column" }}
    >
      {children}
    </View>
  );
}

function Header({ title, chip, onBack, insetTop }: { title: string; chip: string; onBack: () => void; insetTop: number }) {
  return (
    <View style={{ height: 64 + insetTop, paddingTop: insetTop, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, backgroundColor: alpha("bg1", 0.9) }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to map" onPress={onBack} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path d="M10 3 5 8l5 5" stroke={C.fg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w={700} size={10} ls={1.1} color={C.accent2}>STREET LEVEL</T>
        <T w={700} size={15} ls={-0.2} numberOfLines={1}>{title}</T>
      </View>
      {!!chip && (
        <View style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: C.card }}>
          <T w={700} size={9} ls={0.6} color={C.warm}>{chip}</T>
        </View>
      )}
    </View>
  );
}

function Pill({ children, color }: { children: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: alpha("bg1", 0.85) }}>
      <T w={600} size={9} ls={0.5} color={color}>{children}</T>
    </View>
  );
}
