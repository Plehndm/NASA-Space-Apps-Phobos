// The frame Settings and About share: phone = bottom sheet, desktop = centred 480 px dialog, over a
// dimmed backdrop that closes it. Title row with an optional back button and DONE, then a scrolling body.
// Escape closes it on web; Android's back button is handled in AppShell.
import { useEffect, useRef, type ComponentRef, type ReactNode, type Ref } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useApp } from "../state/store";
import { C, R, SHADOW } from "../theme";
import { T } from "../ui/Text";

export function Dialog({ label, title, onClose, onBack, backLabel, scrollRef, children }: {
  label: string; // accessibility name, e.g. "Settings"
  title: string;
  onClose: () => void; // backdrop, DONE, Escape
  onBack?: () => void; // shows a ‹ button before the title
  backLabel?: string;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  children: ReactNode;
}) {
  const { geo } = useApp();
  const desk = geo.device === "desktop";

  // The latest onClose, so the key listener isn't re-added on every render.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Pressable accessibilityLabel={`Close ${label.toLowerCase()}`} onPress={onClose} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(20,11,9,0.55)", zIndex: 9 }} />
      <View
        accessibilityViewIsModal
        accessibilityLabel={label}
        style={[
          { position: "absolute", zIndex: 10, overflow: "hidden", backgroundColor: C.bg2 },
          desk
            ? { left: (geo.W - 480) / 2, width: 480, top: 40, maxHeight: geo.H - 80, borderRadius: R.sheet, boxShadow: SHADOW.s2, alignSelf: "center" }
            : { left: 0, right: 0, bottom: 0, maxHeight: Math.min(740, geo.H - geo.insetTop - 20), borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, boxShadow: SHADOW.sheet },
        ]}
      >
        {desk ? (
          <View style={{ height: 20 }} />
        ) : (
          <View style={{ height: 24, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel ?? "Back"}
              onPress={onBack}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}
            >
              <T w={700} size={18} lh={1} color={C.fg} style={{ marginTop: -2 }}>‹</T>
            </Pressable>
          )}
          <T w={700} size={22} ls={-0.5} numberOfLines={1} style={{ flex: 1 }}>{title}</T>
          <Pressable accessibilityRole="button" onPress={onClose} style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.raised, justifyContent: "center" }}>
            <T w={700} size={10.5} ls={0.5}>DONE</T>
          </Pressable>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 + geo.insetBottom, gap: 10 }}>
          {children}
        </ScrollView>
      </View>
    </>
  );
}
