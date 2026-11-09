import type { ReactNode } from "react";
import { useApp, type Mode } from "../state/store";
import { LayersCard } from "./Layers";
import { WaypointCard } from "./Waypoint";
import { SequenceCard } from "./Sequence";
import { ArrivedCard, ExpeditionCard } from "./Expedition";
import { HomeCard, SectorHeader } from "./Home";
import { SearchCard } from "./Search";
import { AssistantCard } from "./Assistant";
import { HazardFilterRow } from "../map/LayerControls";

/** One entry per sheet mode; each card lives in src/cards/<Name>.tsx. */
const CARDS: Record<Mode, () => ReactNode> = {
  home: () => <HomeCard />,
  search: () => <SearchCard />,
  waypoint: () => <><WaypointCard /><SectorHeader /></>,
  route: () => <SequenceCard />,
  nav: () => <ExpeditionCard />,
  arrived: () => <><ArrivedCard /><SectorHeader /></>,
  layers: () => <LayersCard />,
  assistant: () => <AssistantCard />,
};

/** Sheets that show the hazard filter row while warning zones are on (the design's rule). */
const HAZARD_ROW: Mode[] = ["home", "waypoint", "route", "nav"];

export function CardStack() {
  const { state } = useApp();
  return (
    <>
      {state.hazOn && HAZARD_ROW.includes(state.mode) && <HazardFilterRow />}
      {CARDS[state.mode]()}
    </>
  );
}
