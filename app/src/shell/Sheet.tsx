import { useMemo, useRef, type ComponentRef, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, ScrollView, View } from "react-native";
import { useApp, type SnapName } from "../state/store";
import { C, R, SHADOW } from "../theme";
import { SearchBar } from "./SearchBar";
import { CardStack } from "../cards/CardStack";
import { AssistantHeader, AssistantInput } from "../cards/Assistant";
import { ChevronIcon } from "../ui/icons";

/**
 * Drag handle for the phone sheet. A tap steps min → peek → half → full → peek; a drag snaps to the nearest
 * point. The chevron on the right minimises the sheet to its search bar, or brings it back to peek.
 */
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
          if (Math.abs(g.dy) < 6) next = start.current > p.peek ? "peek" : start.current >= p.peek ? "half" : start.current >= p.half ? "full" : "peek";
          else next = (Object.keys(p) as SnapName[]).sort((a, b) => Math.abs(p[a] - y) - Math.abs(p[b] - y))[0];
          snapTo(next);
        },
        // Another view took the gesture: put the sheet back where it was.
        onPanResponderTerminate: () => sheetTop.setValue(live.current.state.sheetY),
      }),
    [sheetTop],
  );

  const minimised = state.sheetY >= geo.snap.min;
  return (
    <View style={{ height: 24 }}>
      <View
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Resize panel"
        style={{ height: 24, alignItems: "center", justifyContent: "center", cursor: "grab" } as object}
      >
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={minimised ? "Expand panel" : "Minimise panel"}
        onPress={() => snapTo(minimised ? "peek" : "min")}
        hitSlop={8}
        style={{ position: "absolute", right: 12, top: 2, width: 28, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.raised }}
      >
        <ChevronIcon size={13} color={C.fg2} up={minimised} />
      </Pressable>
    </View>
  );
}

/**
 * Phone: bottom sheet with four snap points (full, half, peek, and min: just the search bar). Desktop: fixed 420 px left panel under the header.
 * Both hold the same content: pinned slot (ETA card while navigating), search bar, scrolling card stack.
 */
export function Sheet({ pinned }: { pinned?: ReactNode }) {
  const { geo, sheetTop, state } = useApp();
  const desk = geo.device === "desktop";
  const chat = state.mode === "assistant";
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const body = (
    <>
      {pinned}
      <SearchBar />
      {chat && <AssistantHeader />}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: chat ? 12 : 28 + geo.insetBottom, gap: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // The assistant's chat keeps its newest message in view.
        onContentSizeChange={() => chat && scroll.current?.scrollToEnd({ animated: true })}
      >
        <CardStack />
      </ScrollView>
      {chat && <AssistantInput insetBottom={geo.insetBottom} />}
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
