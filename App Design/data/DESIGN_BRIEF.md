# Gale Crater data layers: brief for the mockup

These are data assets for the Mars route-planning map (Google-Maps style). Add them to the map screen as toggleable layers. `manifest.json` has the exact file list, bounds and frame order.

## Layers

**1. Ground temperature (main overlay)** in `heatmaps/`
- 21 frames, local true solar time (LTST) 01:30 to 11:30 in 30-min steps, season Ls 340. All are 738x718 and opaque.
- They share one fixed color scale: purple = cold, orange/yellow = hot. Frames are comparable with each other.
- Suggested UI: a heat layer toggle plus a time scrubber (01:30 to 11:30) that swaps frames. Show the overlay at about 60% opacity over the basemap.
- `heatmap_sprite_strip.jpg` puts all frames in one row (frame i at x = i x 738) for a CSS-sprite scrubber. `heatmap_timelapse.gif` is a labelled preview.
- The legend needs temperature units and a min/max, which aren't known yet. Use a placeholder "Cold to Hot" gradient bar.

**2. Thermal inertia (reference graphic)** in `thermal_inertia/themis_vs_tes.png`
- A chart with axes and colorbars, comparing THEMIS at 100 m with TES at 3 km resolution (scale 180-500 tiu).
- Use it in an info/side panel ("What's the ground made of?"). It is not a map overlay.

**3. Gale basemap tiles** in `gale_tiles/` (pending)
**4. Topography** in `topography/` (pending)
Leave slots for these in the layer picker.

## Placement
Footprint is approx. 136.75 to 139.25 E, 6.55 to 4.2 S (Gale crater, with Mount Sharp in the centre). North is up.

Credit line: THEMIS/TES NASA/JPL-Caltech/ASU.
