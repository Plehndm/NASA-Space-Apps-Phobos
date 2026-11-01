// Inline SVG icons from the prototype template. They inherit `currentColor`.
type P = { size?: number };

export const LayersIcon = ({ size = 17 }: P) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
    <path d="M8 2.5 14 5.5 8 8.5 2 5.5Z" /><path d="m2 8.5 6 3 6-3M2 11.5l6 3 6-3" />
  </svg>
);
export const HazardIcon = ({ size = 18 }: P) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
    <path d="M8 2.5 14 13H2Z" /><path d="M8 6.5v3M8 11.2v.3" />
  </svg>
);
export const GearIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <circle cx="8" cy="8" r="2.4" />
    <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4l1.6 1.6M11 11l1.6 1.6M3.4 12.6 5 11M11 5l1.6-1.6" />
  </svg>
);
export const SearchIcon = ({ size = 15 }: P) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" />
  </svg>
);
export const FilterIcon = ({ size = 14 }: P) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <path d="M2 4h12M4 8h8M6 12h4" />
  </svg>
);
export const CrosshairIcon = ({ size = 18 }: P) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <circle cx="8" cy="8" r="4" /><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
    <path d="M8 1v3M8 12v3M1 8h3M12 8h3" strokeLinecap="round" />
  </svg>
);
export const CloseIcon = ({ size = 14 }: P) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
