import { Text, type TextProps, type TextStyle } from "react-native";
import { C, font, type Weight } from "../theme";

/**
 * Text in the app font. Every string must be inside a <T> (React Native has no bare text).
 *   <T w={700} size={15} ls={-0.2}>Gale Crater</T>
 */
export function T({ w = 500, size = 13, ls, lh, color = C.fg, style, ...rest }: TextProps & {
  w?: Weight;
  size?: number;
  ls?: number;
  lh?: number;
  color?: string;
  style?: TextStyle | TextStyle[];
}) {
  return <Text {...rest} style={[font(w, size, ls, lh), { color }, style as TextStyle]} />;
}
