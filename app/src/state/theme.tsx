// Light / dark mode: the sun/moon button in the header switches it, like the project page's.
// Dark (the design's look) is the default. The choice is remembered on the device under its own key,
// so Settings → Reset doesn't change it.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES, type Theme, type ThemeName } from "../theme";

const STORAGE_KEY = "mn.theme";

const parse = (v: unknown): ThemeName | null => (v === "light" || v === "dark" ? v : null);

/** On web, AsyncStorage is localStorage, so the saved choice can be read before the first paint (no dark flash). */
function initialTheme(): ThemeName {
  if (Platform.OS !== "web") return "dark";
  try {
    return parse(globalThis.localStorage?.getItem(STORAGE_KEY)) ?? "dark";
  } catch {
    return "dark";
  }
}

interface ThemeCtx extends Theme {
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState<ThemeName>(initialTheme);
  const tapped = useRef(false);

  // Phones: read the saved choice once (async). A tap before it arrives wins.
  useEffect(() => {
    if (Platform.OS === "web") return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => { const t = parse(v); if (t && !tapped.current) setName(t); })
      .catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    tapped.current = true;
    setName(n => {
      const next = n === "light" ? "dark" : "light";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...THEMES[name], toggle }), [name, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The active palette: `const { C, alpha, SHADOW } = useTheme();` Outside a ThemeProvider it is dark. */
export function useTheme(): ThemeCtx {
  return useContext(Ctx) ?? FALLBACK;
}

const FALLBACK: ThemeCtx = { ...THEMES.dark, toggle: () => {} };
