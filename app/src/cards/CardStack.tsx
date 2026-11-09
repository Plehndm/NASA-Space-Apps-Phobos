import type { ReactNode } from "react";
import { useApp, type Mode } from "../state/store";
import { LayersCard } from "./Layers";
import { WaypointCard } from "./Waypoint";
import { SequenceCard } from "./Sequence";
import { ArrivedCard, ExpeditionCard } from "./Expedition";
import { Placeholder } from "./Placeholder";
import { HomeCard, SectorHeader } from "./Home";
import { SearchCard } from "./Search";

/**
 * One entry per sheet mode. Each feature replaces its placeholder with a real component
 * (put it in src/cards/<Name>.tsx and swap it in here).
 */
const CARDS: Record<Mode, () => ReactNode> = {
  home: () => <HomeCard />,
  search: () => <SearchCard />,
  waypoint: () => <><WaypointCard /><SectorHeader /></>,
  route: () => <SequenceCard />,
  nav: () => <ExpeditionCard />,
  arrived: () => <><ArrivedCard /><SectorHeader /></>,
  layers: () => <LayersCard />,
  assistant: () => <Placeholder title="✦ Route assistant" item="Assistant chat UI" note="Chat bubbles, proposed-route card, input row." />,
};

export function CardStack() {
  const { state } = useApp();
  return <>{CARDS[state.mode]()}</>;
}
