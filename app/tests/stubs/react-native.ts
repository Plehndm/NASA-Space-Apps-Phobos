// Just enough of react-native for modules that touch it at import time (src/map/data.ts).
export const Platform = { OS: "test" as const, select: <T,>(o: { default?: T }) => o.default };
export type TextStyle = Record<string, unknown>;
