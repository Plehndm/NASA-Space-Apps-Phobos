import type { ReactNode } from "react";
import { useApp, type Mode } from "../state/store";
import { LayersCard } from "./Layers";
import { Placeholder } from "./Placeholder";

/**
 * One entry per sheet mode. Each feature replaces its placeholder with a real component
 * (put it in src/cards/<Name>.tsx and swap it in here).
 */
const CARDS: Record<Mode, () => ReactNode> = {
  home: () => <Placeholder title="Home" item="Home card" note="Sector card, telemetry tiles, dust-devil advisory, nearby landmarks." />,
  search: () => <Placeholder title="Search" item="Search" note="Category chips, results and recent searches." />,
  waypoint: () => <Placeholder title="Waypoint" item="Waypoint card" note="Target hero card, route pickers, elevation profile, Navigate." />,
  route: () => <Placeholder title="Sequence" item="Multi-stop sequence" note="Numbered stops with reorder / remove and NAVIGATE." />,
  nav: () => <Placeholder title="Expedition" item="Expedition simulation" note="Progress card, hazard radar, grade map, END." />,
  arrived: () => <Placeholder title="Arrived" item="Arrived screen" note="Arrival summary with DONE." />,
  layers: () => <LayersCard />,
  assistant: () => <Placeholder title="✦ Route assistant" item="Assistant chat UI" note="Chat bubbles, proposed-route card, input row." />,
};

export function CardStack() {
  const { state } = useApp();
  return <>{CARDS[state.mode]()}</>;
}
