import { useRef, type ComponentRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useApp } from "../state/store";
import { C, font } from "../theme";
import { CloseIcon, FilterIcon, SearchIcon } from "../ui/icons";

/**
 * Search field pinned at the top of the sheet / panel.
 * The shell wires focus → search mode and Escape (web) → home. Results, chips and
 * submit-to-select belong to checklist item "Search".
 */
export function SearchBar() {
  const { state: S, patch, setMode } = useApp();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const searching = S.mode === "search";
  const leave = () => {
    patch({ q: "" });
    input.current?.blur();
    setMode(S.navActive ? "nav" : "home", "peek");
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 10, height: 46, paddingLeft: 16, paddingRight: 7, borderRadius: 999,
          backgroundColor: C.row, boxShadow: "inset 0px 1px 0px rgba(255,216,190,0.05)",
        }}
      >
        <SearchIcon />
        <TextInput
          ref={input}
          value={S.q}
          accessibilityLabel="Search"
          placeholder="Search craters, bases, coords or quad..."
          placeholderTextColor={C.fg3}
          selectionColor={C.accent}
          returnKeyType="search"
          onChangeText={q => patch({ q })}
          onFocus={() => { if (!searching) setMode("search", "half"); }}
          onKeyPress={e => { if (e.nativeEvent.key === "Escape") leave(); }}
          style={[font(500, 14), { flex: 1, minWidth: 0, color: C.fg, padding: 0, outlineStyle: "none" } as object]}
        />
        {!!S.q && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => patch({ q: "" })} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <CloseIcon size={12} color={C.fg3} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searching ? "Close search" : "Browse categories"}
          onPress={() => (searching ? leave() : setMode("search", "half"))}
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: searching ? C.accent : C.raised }}
        >
          <FilterIcon color={searching ? C.accentInk : C.fg} />
        </Pressable>
      </View>
    </View>
  );
}
