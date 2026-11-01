// Every image the app uses. React Native needs a static require() per file.
// Swap these for pipeline outputs as the data features land.
import type { ImageSourcePropType } from "react-native";

/** World space is 512×683 px; one world px = 100 m. Every map layer is drawn in world px. */
export const WORLD = { w: 512, h: 683 };

export const MAP = {
  /** CTX base mosaic with the design's tint baked in (scripts/tint_map.py). */
  world: require("../assets/map/world-tinted.png") as ImageSourcePropType,
  elev: [
    require("../assets/map/elev-l1.png"),
    require("../assets/map/elev-l2.png"),
    require("../assets/map/elev-l3.png"),
  ] as ImageSourcePropType[],
};

/** THEMIS ground-temperature frames, 01:30 → 11:30 LTST in 30-minute steps (21 frames). */
export const HEAT_FRAMES: { ltst: string; src: ImageSourcePropType }[] = [
  { ltst: "01:30", src: require("../assets/map/heat/ltst_0130.jpg") },
  { ltst: "02:00", src: require("../assets/map/heat/ltst_0200.jpg") },
  { ltst: "02:30", src: require("../assets/map/heat/ltst_0230.jpg") },
  { ltst: "03:00", src: require("../assets/map/heat/ltst_0300.jpg") },
  { ltst: "03:30", src: require("../assets/map/heat/ltst_0330.jpg") },
  { ltst: "04:00", src: require("../assets/map/heat/ltst_0400.jpg") },
  { ltst: "04:30", src: require("../assets/map/heat/ltst_0430.jpg") },
  { ltst: "05:00", src: require("../assets/map/heat/ltst_0500.jpg") },
  { ltst: "05:30", src: require("../assets/map/heat/ltst_0530.jpg") },
  { ltst: "06:00", src: require("../assets/map/heat/ltst_0600.jpg") },
  { ltst: "06:30", src: require("../assets/map/heat/ltst_0630.jpg") },
  { ltst: "07:00", src: require("../assets/map/heat/ltst_0700.jpg") },
  { ltst: "07:30", src: require("../assets/map/heat/ltst_0730.jpg") },
  { ltst: "08:00", src: require("../assets/map/heat/ltst_0800.jpg") },
  { ltst: "08:30", src: require("../assets/map/heat/ltst_0830.jpg") },
  { ltst: "09:00", src: require("../assets/map/heat/ltst_0900.jpg") },
  { ltst: "09:30", src: require("../assets/map/heat/ltst_0930.jpg") },
  { ltst: "10:00", src: require("../assets/map/heat/ltst_1000.jpg") },
  { ltst: "10:30", src: require("../assets/map/heat/ltst_1030.jpg") },
  { ltst: "11:00", src: require("../assets/map/heat/ltst_1100.jpg") },
  { ltst: "11:30", src: require("../assets/map/heat/ltst_1130.jpg") },
];
