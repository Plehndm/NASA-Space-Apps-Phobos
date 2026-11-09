import { useEffect, useState } from "react";

// Mars Coordinated Time shown in the header. The prototype starts the demo at 14:32:08 MTC.

/** The mission sol the demo is set on (the design's "Sol 742"); Home telemetry reads τ for it. */
export const SOL = 742;
const START_S = 52328;
const t0 = Date.now();

/** Seconds since MTC midnight, now. */
export function mtcSeconds(): number {
  return (START_S + Math.floor((Date.now() - t0) / 1000)) % 86400;
}

export function fmtClock(s: number, withSeconds = true): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const hh = Math.floor(s / 3600) % 24, mm = Math.floor(s / 60) % 60;
  return withSeconds ? `${p(hh)}:${p(mm)}:${p(s % 60)}` : `${p(hh)}:${p(mm)}`;
}

/** Re-renders every second with the current MTC time, "HH:MM:SS". */
export function useMtcClock(): string {
  const [s, setS] = useState(mtcSeconds);
  useEffect(() => {
    const id = setInterval(() => setS(mtcSeconds()), 1000);
    return () => clearInterval(id);
  }, []);
  return fmtClock(s);
}
