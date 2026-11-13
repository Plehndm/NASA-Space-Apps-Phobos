// SVG icons from the prototype template (react-native-svg). Pass `color`; default is the text colour.
import Svg, { Circle, Path } from "react-native-svg";
import { C } from "../theme";

type P = { size?: number; color?: string };

export const LayersIcon = ({ size = 17, color = C.fg }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
    <Path d="M8 2.5 14 5.5 8 8.5 2 5.5Z" />
    <Path d="m2 8.5 6 3 6-3M2 11.5l6 3 6-3" />
  </Svg>
);

export const HazardIcon = ({ size = 18, color = C.fg }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
    <Path d="M8 2.5 14 13H2Z" />
    <Path d="M8 6.5v3M8 11.2v.3" />
  </Svg>
);

// An 8-tooth gear (teeth between radius 5.3 and 6.9 around the centre) with a hole in the middle.
export const GearIcon = ({ size = 16, color = C.fg }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
    <Path d="M13.14 6.72L14.81 6.87L14.81 9.13L13.14 9.28L12.54 10.73L13.61 12.01L12.01 13.61L10.73 12.54L9.28 13.14L9.13 14.81L6.87 14.81L6.72 13.14L5.27 12.54L3.99 13.61L2.39 12.01L3.46 10.73L2.86 9.28L1.19 9.13L1.19 6.87L2.86 6.72L3.46 5.27L2.39 3.99L3.99 2.39L5.27 3.46L6.72 2.86L6.87 1.19L9.13 1.19L9.28 2.86L10.73 3.46L12.01 2.39L13.61 3.99L12.54 5.27Z" />
    <Circle cx="8" cy="8" r="2.2" />
  </Svg>
);

export const SearchIcon = ({ size = 15, color = C.fg3 }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
    <Circle cx="7" cy="7" r="4.5" />
    <Path d="M10.5 10.5 14 14" />
  </Svg>
);

export const FilterIcon = ({ size = 14, color = C.fg }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
    <Path d="M2 4h12M4 8h8M6 12h4" />
  </Svg>
);

export const CrosshairIcon = ({ size = 18, color = C.accent2 }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.6}>
    <Circle cx="8" cy="8" r="4" />
    <Circle cx="8" cy="8" r="1.2" fill={color} stroke="none" />
    <Path d="M8 1v3M8 12v3M1 8h3M12 8h3" strokeLinecap="round" />
  </Svg>
);

export const ChevronIcon = ({ size = 14, color = C.fg, up = false }: P & { up?: boolean }) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
    <Path d={up ? "m3.5 10 4.5-4.5 4.5 4.5" : "m3.5 6 4.5 4.5 4.5-4.5"} />
  </Svg>
);

export const CloseIcon = ({ size = 14, color = C.fg }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);
