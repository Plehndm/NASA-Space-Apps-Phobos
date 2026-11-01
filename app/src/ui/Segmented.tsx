import { Pressable, View } from "react-native";
import { C } from "../theme";
import { T } from "./Text";

/** Segmented control: `row` track, selected segment is `fg` with `raised` text. */
export function Segmented<V extends string>({ value, options, onChange }: {
  value: V;
  options: [V, string][];
  onChange: (v: V) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4, backgroundColor: C.row, padding: 3, borderRadius: 999 }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(v)}
            style={{ flex: 1, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.fg : "transparent" }}
          >
            <T w={700} size={10} ls={0.4} color={on ? C.raised : C.fg2}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
