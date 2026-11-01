import type { CSSProperties, ReactNode } from "react";

/** Uppercase label above a group of cards ("NEARBY LANDMARKS", "MAP", ...). */
export function SectionLabel({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <div style={{ font: "700 10.5px var(--font-ui)", letterSpacing: 1, color: "var(--fg3)", paddingLeft: 4, marginTop: first ? 0 : 6 }}>
      {children}
    </div>
  );
}

/** `--card` surface. `pebble` gives the hand-drawn radius; alternate `pebble={1}` / `pebble={2}` between neighbours. */
export function Card({ children, pebble, style }: { children: ReactNode; pebble?: 1 | 2; style?: CSSProperties }) {
  const radius = pebble === 1 ? "var(--r-pebble)" : pebble === 2 ? "var(--r-pebble2)" : "var(--r-card)";
  return <div style={{ background: "var(--card)", borderRadius: radius, padding: "14px 16px", ...style }}>{children}</div>;
}
