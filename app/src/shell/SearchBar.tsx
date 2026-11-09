import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useApp } from "../state/store";
import { C, font } from "../theme";
import { CloseIcon, FilterIcon, SearchIcon } from "../ui/icons";
import { fmtInt, fmtLatLon } from "../map/geo";
import { terrainAt, useMapData } from "../map/data";
import { useRoutes } from "../route/RouteProvider";
import { MAX_QUERY, parseCoords, results } from "../home/search";

/**
 * Search field pinned at the top of the sheet / panel. Focus (or the filter button) opens Search;
 * Enter opens the nearest match, or goes to a typed coordinate; Escape (web) or the filter button
 * leaves. During an expedition, searching edits the remaining stops (the design's "add stop" path).
 */
export function SearchBar() {
  const { state: S, patch, setMode, goHome, centerOn, showCoord, toast } = useApp();
  const r = useRoutes();
  const { terrain } = useMapData();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const searching = S.mode === "search";

  // The field keeps its own text so typing never waits for the map to re-render (a controlled input
  // that lags drops keystrokes on iOS); the store's query follows ~120 ms after typing pauses.
  const [text, setText] = useState(S.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);
  useEffect(() => { if (!pending.current) setText(S.q); }, [S.q]); // cleared from elsewhere
  // Leaving Search (a result opened, or Home) drops any typing still waiting and shows the store's
  // query. Opening a result flushes the text and clears it in the same update, so the effect above
  // never sees the query change and the field would keep the old text.
  useEffect(() => {
    if (searching) return;
    clearTimeout(timer.current);
    pending.current = false;
    setText(S.q);
  }, [searching]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);
  const type = (q: string) => {
    const v = q.slice(0, MAX_QUERY);
    setText(v);
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { pending.current = false; patch({ q: v }); }, 120);
    if (!searching) enter();
  };
  const flush = () => {
    clearTimeout(timer.current);
    pending.current = false;
    if (text !== S.q) patch({ q: text });
    return text;
  };

  const enter = () => {
    if (searching) return;
    if (S.nav) patch({ stops: S.nav.stops.filter(id => !id.startsWith("via-")), viaPending: false });
    patch({ elevOpen: false, heatOpen: false });
    setMode("search", "half");
  };
  const leave = () => {
    input.current?.blur();
    goHome(); // also clears the query and category
  };
  const submit = () => {
    const q = flush();
    const p = parseCoords(q);
    if (p) {
      input.current?.blur();
      const t = terrainAt(terrain, p);
      goHome("peek");
      centerOn(p);
      showCoord(t ? `${fmtLatLon(p)} · ${fmtInt(t.elev)} m · ${Math.round(t.slope)}° slope` : fmtLatLon(p), 4000);
      return;
    }
    const first = results(q, S.cat, S.rover)[0];
    if (!first) return toast(q.trim() ? `No landmark matches “${q.trim().slice(0, 40)}”` : "Type a name, a category or a coordinate");
    input.current?.blur();
    r.select(first.id, "search");
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
          value={text}
          accessibilityLabel="Search"
          placeholder="Search craters, bases, coords or quad..."
          placeholderTextColor={C.fg3}
          selectionColor={C.accent}
          returnKeyType="search"
          maxLength={MAX_QUERY}
          autoCorrect={false}
          autoCapitalize="none"
          onChangeText={type}
          onFocus={enter}
          onSubmitEditing={submit}
          onKeyPress={e => { if (e.nativeEvent.key === "Escape") leave(); }}
          style={[font(500, 14), { flex: 1, minWidth: 0, color: C.fg, padding: 0, outlineStyle: "none" } as object]}
        />
        {!!text && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { clearTimeout(timer.current); pending.current = false; setText(""); patch({ q: "" }); }} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <CloseIcon size={12} color={C.fg3} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searching ? "Close search" : "Browse categories"}
          onPress={() => (searching ? leave() : enter())}
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: searching ? C.accent : C.raised }}
        >
          <FilterIcon color={searching ? C.accentInk : C.fg} />
        </Pressable>
      </View>
    </View>
  );
}
