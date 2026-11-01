import { useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, ScrollView, View } from "react-native";
import { useApp, type SnapName } from "../state/store";
import { C, R, SHADOW } from "../theme";
import { SearchBar } from "./SearchBar";
import { CardStack } from "../cards/CardStack";

/** Drag handle for the phone sheet. A tap steps peek → half → full → peek; a drag snaps to the nearest point. */
function Handle() {
  const { state, geo, sheetTop, snapTo } = useApp();
  // PanResponder is created once, so read the latest values through a ref.
  const live = useRef({ state, geo, snapTo });
  live.current = { state, geo, snapTo };
  const start = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          sheetTop.stopAnimation(v => { start.current = v; });
        },
        onPanResponderMove: (_, g) => {
          const { geo } = live.current;
          sheetTop.setValue(Math.max(geo.sheetMin, Math.min(geo.sheetMax, start.current + g.dy)));
        },
        onPanResponderRelease: (_, g) => {
          const { geo, snapTo } = live.current;
          const p = geo.snap;
          const y = Math.max(geo.sheetMin, Math.min(geo.sheetMax, start.current + g.dy));
          let next: SnapName;
          if (Math.abs(g.dy) < 6) next = start.current >= p.peek ? "half" : start.current >= p.half ? "full" : "peek";
          else next = (Object.keys(p) as SnapName[]).sort((a, b) => Math.abs(p[a] - y) - Math.abs(p[b] - y))[0];
          snapTo(next);
        },
        // Another view took the gesture: put the sheet back where it was.
        onPanResponderTerminate: () => sheetTop.setValue(live.current.state.sheetY),
      }),
    [sheetTop],
  );

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Resize panel"
      style={{ height: 24, alignItems: "center", justifyContent: "center", cursor: "grab" } as object}
    >
      <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
    </View>
  );
}

/**
 * Phone: bottom sheet with three snap points. Desktop: fixed 420 px left panel under the header.
 * Both hold the same content: pinned slot (ETA card while navigating), search bar, scrolling card stack.
 */
export function Sheet({ pinned }: { pinned?: ReactNode }) {
  const { geo, sheetTop } = useApp();
  const desk = geo.device === "desktop";

  const body = (
    <>
      {pinned}
      <SearchBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 + geo.insetBottom, gap: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CardStack />
      </ScrollView>
    </>
  );

  if (desk) {
    return (
      <View
        accessibilityLabel="Panel"
        style={{
          position: "absolute", left: 0, top: geo.headerH, width: geo.panelW, height: geo.H - geo.headerH, zIndex: 4,
          backgroundColor: C.bg2, boxShadow: SHADOW.side, paddingTop: 14,
        }}
      >
        {body}
      </View>
    );
  }

  return (
    <Animated.View
      accessibilityLabel="Panel"
      style={{
        position: "absolute", left: 0, width: geo.W, top: sheetTop, height: Animated.subtract(geo.H, sheetTop), zIndex: 4,
        backgroundColor: C.sheet, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet,
        boxShadow: `${SHADOW.sheet}, inset 0px 1px 0px rgba(255,216,190,0.08)`,
      }}
    >
      <Handle />
      {body}
    </Animated.View>
  );
}
