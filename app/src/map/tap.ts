// What a tap on empty map does, as a plain function so the rules can be tested without the map.
// A tap that only dismisses something (a popover, a landmark's card) never drops a pin, and screens
// with their own task (Search, Layers, the assistant, the sequence, Arrived) keep it: there the tap
// only shows the coordinate pill.
import type { Mode } from "../state/store";

/** Dropped pins are run-time landmarks with ids starting with this. */
export const PIN_PREFIX = "pin-";
export const isPin = (id: string | null | undefined) => !!id && id.startsWith(PIN_PREFIX);

export type TapAction =
  | "via" //          REROUTE is armed: the tap is the via-point
  | "closePopover" // the elevation or heat popover is open: the tap only closes it
  | "closeCard" //    a landmark's card is open: close it (back to the sequence or Home)
  | "dropPin" //      Home, or a pin's card (moves the pin): drop a pin there
  | "coordOnly"; //   anything else: just show where the tap was

export interface TapState {
  mode: Mode;
  sel: string | null;
  nav: unknown;
  viaPending: boolean;
  elevOpen: boolean;
  heatOpen: boolean;
}

export function tapAction(s: TapState): TapAction {
  if (s.viaPending && s.nav) return "via";
  if (s.elevOpen || s.heatOpen) return "closePopover";
  if (s.mode === "waypoint" && !isPin(s.sel)) return "closeCard";
  if (!s.nav && (s.mode === "home" || (s.mode === "waypoint" && isPin(s.sel)))) return "dropPin";
  return "coordOnly";
}
