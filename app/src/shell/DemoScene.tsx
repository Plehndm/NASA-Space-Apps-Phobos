// Applies the demo scene from the URL (src/state/scenes.ts) once, through the app's own actions. Scenes
// that plan routes wait for the routing grid; the assistant also waits for the dust-devil advisory, so
// its scripted answer is the full one. Renders nothing, and is not mounted at all without a scene.
import { useEffect, useRef } from "react";
import { useApp } from "../state/store";
import { useMapData } from "../map/data";
import { useRoutes } from "../route/RouteProvider";
import { useAssistant } from "../assistant/AssistantProvider";
import { useDustAdvisory } from "../home/advisory";
import { ASSISTANT_Q, NAV_PROGRESS, NAV_STOPS, NAV_ZOOM, needsRoutes, ROUTE_STOPS, SEARCH_CAT, startScene, WAYPOINT, type Scene } from "../state/scenes";

const START = startScene();

export function DemoScene() {
  return START ? <Apply scene={START} /> : null;
}

function Apply({ scene }: { scene: Scene }) {
  const { state: S, patch, setMode, snapTo, centerOn, toast } = useApp();
  const { status, manifest } = useMapData();
  const r = useRoutes();
  const { send } = useAssistant();
  const adv = useDustAdvisory();
  const applied = useRef(false);
  const skipped = useRef(false);

  const waiting =
    (needsRoutes(scene) && !r.ready) || (scene === "assistant" && !!manifest?.dustDevil && !adv);

  useEffect(() => {
    if (applied.current) return;
    if (waiting) {
      if (status === "offline") {
        applied.current = true;
        toast(`Scene “${scene}” needs the map data`);
      }
      return;
    }
    applied.current = true;
    switch (scene) {
      case "layers":
        patch({ heat: "on", heatOpen: true, hazOn: true });
        snapTo("peek");
        break;
      case "search":
        patch({ q: "", cat: SEARCH_CAT });
        setMode("search", "half");
        break;
      case "waypoint":
        r.select(WAYPOINT);
        break;
      case "route":
        patch({ stops: ROUTE_STOPS, routeOpt: 2, sel: null });
        setMode("route", "half");
        break;
      case "nav":
        r.beginNav(NAV_STOPS); // the rest happens below, once the expedition is in the state
        break;
      case "assistant":
        setMode("assistant", "full");
        send(ASSISTANT_Q, { offline: true });
        break;
      case "settings":
        patch({ settingsOpen: true });
        break;
    }
  }, [scene, waiting, status, r, send, patch, setMode, snapTo, toast]);

  // Nav: once the expedition runs, jump it ahead and follow the rover. The simulation carries on.
  useEffect(() => {
    if (scene !== "nav" || !S.nav || skipped.current) return;
    skipped.current = true;
    const rover = r.skipAhead(NAV_PROGRESS);
    if (!rover) return;
    patch({ toast: null });
    snapTo("half");
    centerOn(rover, Math.max(S.view.s, NAV_ZOOM));
  }, [scene, S.nav, S.view.s, r, patch, snapTo, centerOn]);

  return null;
}
