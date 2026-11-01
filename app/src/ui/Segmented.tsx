/** Segmented control: `--row` track, selected segment is `--fg` with `--raised` text. */
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" style={{ display: "flex", gap: 4, background: "var(--row)", padding: 3, borderRadius: 999 }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            style={{
              flex: 1, height: 32, borderRadius: 999, border: 0, cursor: "pointer", transition: "background .2s",
              background: on ? "var(--fg)" : "transparent", color: on ? "var(--raised)" : "var(--fg2)",
              font: "700 10px var(--font-ui)", letterSpacing: ".4px",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
