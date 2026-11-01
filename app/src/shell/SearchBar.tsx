import type { KeyboardEvent } from "react";
import { useApp } from "../state/store";
import { CloseIcon, FilterIcon, SearchIcon } from "../ui/icons";

/**
 * Search field pinned at the top of the sheet / panel.
 * The shell wires focus → search mode and Escape → home. Results, chips and Enter-to-select
 * belong to checklist item "Search".
 */
export function SearchBar() {
  const { state: S, patch, setMode } = useApp();
  const searching = S.mode === "search";
  const leave = () => { patch({ q: "" }); setMode(S.navActive ? "nav" : "home", "peek"); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { leave(); e.currentTarget.blur(); }
  };

  return (
    <div style={{ padding: "0 16px 10px", flex: "none" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 7px 0 16px", borderRadius: 999,
          background: "var(--row)", boxShadow: "inset 0 1px 0 rgba(255,216,190,.05)",
        }}
      >
        <span style={{ color: "var(--fg3)", display: "flex", flex: "none" }}><SearchIcon /></span>
        <input
          value={S.q}
          aria-label="Search"
          placeholder="Search craters, bases, coords or quad..."
          onChange={e => patch({ q: e.target.value })}
          onFocus={() => { if (!searching) setMode("search", "half"); }}
          onKeyDown={onKey}
          style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: 0, color: "var(--fg)", font: "500 14px var(--font-ui)", padding: 0 }}
        />
        {S.q && (
          <button aria-label="Clear search" onClick={() => patch({ q: "" })} style={{ width: 32, height: 32, borderRadius: "50%", background: "none", border: 0, color: "var(--fg3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CloseIcon size={12} />
          </button>
        )}
        <button
          aria-label={searching ? "Close search" : "Browse categories"}
          onClick={() => (searching ? leave() : setMode("search", "half"))}
          style={{
            width: 32, height: 32, borderRadius: "50%", border: 0, cursor: "pointer", flex: "none", transition: "background .2s",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: searching ? "var(--accent)" : "var(--raised)", color: searching ? "var(--accent-ink)" : "var(--fg)",
          }}
        >
          <FilterIcon />
        </button>
      </div>
    </div>
  );
}
