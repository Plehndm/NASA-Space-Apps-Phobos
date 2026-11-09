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

export const GearIcon = ({ size = 16, color = C.fg }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Circle cx="8" cy="8" r="2.4" />
    <Path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4l1.6 1.6M11 11l1.6 1.6M3.4 12.6 5 11M11 5l1.6-1.6" />
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

export const CloseIcon = ({ size = 14, color = C.fg }: P) => (
  <Svg pointerEvents="none" viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);
