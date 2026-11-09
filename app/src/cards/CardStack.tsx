import type { ReactNode } from "react";
import { useApp, type Mode } from "../state/store";
import { LayersCard } from "./Layers";
import { WaypointCard } from "./Waypoint";
import { SequenceCard } from "./Sequence";
import { ArrivedCard, ExpeditionCard } from "./Expedition";
import { Placeholder } from "./Placeholder";

/**
 * One entry per sheet mode. Each feature replaces its placeholder with a real component
 * (put it in src/cards/<Name>.tsx and swap it in here).
 */
const CARDS: Record<Mode, () => ReactNode> = {
  home: () => <Placeholder title="Home" item="Home card" note="Sector card, telemetry tiles, dust-devil advisory, nearby landmarks." />,
  search: () => <Placeholder title="Search" item="Search" note="Category chips, results and recent searches." />,
  waypoint: () => <WaypointCard />,
  route: () => <SequenceCard />,
  nav: () => <ExpeditionCard />,
  arrived: () => <ArrivedCard />,
  layers: () => <LayersCard />,
  assistant: () => <Placeholder title="✦ Route assistant" item="Assistant chat UI" note="Chat bubbles, proposed-route card, input row." />,
};

export function CardStack() {
  const { state } = useApp();
  return <>{CARDS[state.mode]()}</>;
}
