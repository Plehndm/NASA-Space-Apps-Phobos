// Dust opacity τ helpers: plain functions, no React, so tests can import them directly.
import type { TauTable } from "../map/data";

export interface Tau { tau: number; ls: number; source: string }

/**
 * τ for a sol, as the dust-devil pipeline does it: a Mastcam measurement on that sol, or linear
 * interpolation between measurements within `max_gap_sols`; otherwise the nearest measured sol,
 * labelled as such.
 */
export function tauForSol(t: TauTable, sol: number): Tau | null {
  const n = t.sol.length;
  if (!n) return null;
  let hi = t.sol.findIndex(s => s >= sol);
  if (hi === -1) hi = n;
  if (hi < n && t.sol[hi] === sol) return { tau: t.tau[hi], ls: t.ls[hi], source: `Mastcam, sol ${sol}` };
  const lo = hi - 1;
  if (lo >= 0 && hi < n && sol - t.sol[lo] <= t.max_gap_sols && t.sol[hi] - sol <= t.max_gap_sols) {
    const f = (sol - t.sol[lo]) / (t.sol[hi] - t.sol[lo]);
    return { tau: t.tau[lo] + (t.tau[hi] - t.tau[lo]) * f, ls: t.ls[lo] + (t.ls[hi] - t.ls[lo]) * f, source: `Mastcam, interpolated sols ${t.sol[lo]}–${t.sol[hi]}` };
  }
  const near = lo < 0 ? hi : hi >= n ? lo : sol - t.sol[lo] <= t.sol[hi] - sol ? lo : hi;
  return { tau: t.tau[near], ls: t.ls[near], source: `Mastcam, nearest sol ${t.sol[near]}` };
}

/** "LOW" / "MODERATE" / "HIGH" / "STORM" for a τ (Gale's clear season runs ~0.3–0.6; the 2018 storm reached 8.6). */
export const tauLevel = (tau: number) => (tau < 0.6 ? "LOW" : tau < 1.0 ? "MODERATE" : tau < 2 ? "HIGH" : "STORM");

/** The map season (Ls) closest to ls, wrapping at 360°. */
export function nearestSeason<T extends { ls: number }>(seasons: T[], ls: number): T | null {
  const d = (a: number) => Math.min(Math.abs(a - ls), 360 - Math.abs(a - ls));
  return seasons.reduce<T | null>((b, s) => (!b || d(s.ls) < d(b.ls) ? s : b), null);
}
