import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { C, R } from "../theme";
import { T } from "./Text";

/** Uppercase label above a group of cards ("NEARBY LANDMARKS", "MAP", ...). */
export function SectionLabel({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <T w={700} size={10.5} ls={1} color={C.fg3} style={{ paddingLeft: 4, marginTop: first ? 0 : 6 }}>
      {children}
    </T>
  );
}

/** `card` surface. `pebble` gives the hand-drawn radius; alternate `pebble={1}` / `pebble={2}` between neighbours. */
export function Card({ children, pebble, style }: { children: ReactNode; pebble?: 1 | 2; style?: ViewStyle }) {
  const radius = pebble === 1 ? R.pebble : pebble === 2 ? R.pebble2 : { borderRadius: R.card };
  return <View style={[{ backgroundColor: C.card, paddingVertical: 14, paddingHorizontal: 16 }, radius, style]}>{children}</View>;
}
