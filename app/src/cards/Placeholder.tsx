import { Pressable, View } from "react-native";
import { useApp } from "../state/store";
import { alpha, C } from "../theme";
import { Card } from "../ui/Card";
import { T } from "../ui/Text";
import { CloseIcon } from "../ui/icons";

/** Stand-in for a card stack that has not been built yet. Names the checklist item that owns it. */
export function Placeholder({ title, item, note }: { title: string; item: string; note: string }) {
  const { state, setMode } = useApp();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
        <T w={700} size={22} ls={-0.5}>{title}</T>
        {state.mode !== "home" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => setMode(state.navActive ? "nav" : "home", "peek")}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}
          >
            <CloseIcon />
          </Pressable>
        )}
      </View>
      <Card pebble={1} style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: C.line, backgroundColor: alpha("row", 0.6) }}>
        <T w={700} size={9} ls={1} color={C.warm}>NOT BUILT YET</T>
        <T w={600} size={14} style={{ marginTop: 6 }}>{item}</T>
        <T w={500} size={12} lh={1.5} color={C.fg2} style={{ marginTop: 4 }}>{note}</T>
        <T w={500} size={10.5} lh={1.45} color={C.fg3} style={{ marginTop: 8 }}>
          Claim it in issue #3, then replace this placeholder in src/cards/CardStack.tsx.
        </T>
      </Card>
    </>
  );
}
