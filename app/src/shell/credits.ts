// About screen text: what the app is, who made it, and where every layer's data comes from. Plain
// TypeScript, no React. Citations are copied from MarsDataPipline/raw_data/Citations (italics dropped,
// the DOI or URL split off so it can be tapped); add new ones there first. The credit lines the map data
// carries (manifest imagery.attribution, heat.credit) win over the built-in copies.
import type { Manifest } from "../map/data";

/** From the root README.md, "The goal". */
export const ABOUT_GOAL =
  "Mars Navigator is a Google-Maps-style navigation app for crews driving a rover in Gale Crater (Curiosity's landing site, with Mount Sharp at the centre). It combines real NASA orbital and rover data into one map: CTX imagery and stereo terrain, modelled ground and air temperature through the day, a dust-devil heating index, hazard-aware routing, Street Level panoramas and a route assistant.";

export const ABOUT_TEAM = "Team Phobos · NASA Space Apps 2026";
export const ABOUT_CHALLENGE = "Interplanetary Survival Guide: Martian Map";

export interface CreditLine {
  text: string;
  url?: string;
}
export interface CreditGroup {
  title: string;
  credit?: string; // the short credit line shown on the map, when the layer has one
  lines: CreditLine[];
}

/** Credit groups by map layer, using the manifest's own credit lines when the map data is loaded. */
export function creditGroups(m: Manifest | null): CreditGroup[] {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return [
    {
      title: "BASE IMAGERY · MRO CTX",
      credit: str(m?.imagery?.attribution) ?? "Image: NASA/JPL-Caltech/MSSS",
      lines: [
        { text: "NASA/JPL-Caltech/MSSS. (n.d.). Gale Crater CTX block-adjusted mosaic (Gale_CTX_BlockAdj_dd) [WMTS tile layer]. NASA Solar System Treks, Mars Trek.", url: "https://trek.nasa.gov/tiles/Mars/EQ/Gale_CTX_BlockAdj_dd" },
        { text: "Malin, M. C., Bell, J. F., III, Cantor, B. A., Caplinger, M. A., Calvin, W. M., et al. (2007). Context Camera investigation on board the Mars Reconnaissance Orbiter. Journal of Geophysical Research, 112, E05S04.", url: "https://doi.org/10.1029/2006JE002808" },
      ],
    },
    {
      title: "TERRAIN · ELEVATION STRATA · ROUTES",
      credit: "DTM: NASA/JPL-Caltech/MSSS/NHM. The stereo DTM processing was carried out at the Natural History Museum, London.",
      lines: [
        { text: "Grindrod, P. M., & Davis, J. (2018). Gale Crater Stereo CTX DTMs + Orthoimages (Version 1) [Data set]. figshare.", url: "https://doi.org/10.6084/m9.figshare.6584984.v1" },
      ],
    },
    {
      title: "TEMPERATURE · GROUND AND AIR",
      credit: str(m?.heat?.credit) ?? "Model: Team Phobos (physics baseline + REMS-fitted correction); THEMIS/TES NASA/JPL-Caltech/ASU",
      lines: [
        { text: "Fergason, R. L. (n.d.). THEMIS Thermal Inertia Mosaic, Quantitative, 30S120E, 100 m/pixel [Data set]. USGS Astrogeology Science Center.", url: "https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s120e_100mpp" },
        { text: "Fergason, R. L., Christensen, P. R., & Kieffer, H. H. (2006). High-resolution thermal inertia derived from the Thermal Emission Imaging System (THEMIS): Thermal model and applications. Journal of Geophysical Research, 111(E12), E12004.", url: "https://doi.org/10.1029/2006JE002735" },
        { text: "Putzig, N. E., & Mellon, M. T. (2007). TES albedo maps, Mars Years 24–26, 20 pixels per degree [Data set]. Planetary Science Institute.", url: "https://se.psi.edu/inertia/2007/albedo.html" },
        { text: "Gómez-Elvira, J., & REMS Team. (n.d.). MSL Rover Environmental Monitoring Station (REMS) Reduced Data Records, volume mslrem_1001 [Data set]. NASA Planetary Data System, Atmospheres Node, New Mexico State University.", url: "https://pds-atmospheres.nmsu.edu/cgi-bin/getdir.pl?volume=mslrem_1001" },
        { text: "Gómez-Elvira, J., Armiens, C., Castañer, L., Domínguez, M., Genzer, M., Gómez, F., et al. (2012). REMS: The environmental sensor suite for the Mars Science Laboratory rover. Space Science Reviews, 170, 583–640.", url: "https://doi.org/10.1007/s11214-012-9921-1" },
      ],
    },
    {
      title: "DUST OPACITY τ · SEASONS AND HOME",
      lines: [
        { text: "Lemmon, M. T. (2024). Mars Science Laboratory aerosol optical depths (Version 3) [Data set]. Mendeley Data.", url: "https://doi.org/10.17632/tbh3pg39xc.3" },
        { text: "Lemmon, M. T., Guzewich, S. D., Battalio, J. M., Malin, M. C., Vicente-Retortillo, A., Zorzano, M.-P., et al. (2024). The Mars Science Laboratory record of optical depth measurements via solar imaging. Icarus, 408, 115821.", url: "https://doi.org/10.1016/j.icarus.2023.115821" },
      ],
    },
    {
      title: "DUST-DEVIL HEATING INDEX",
      lines: [{ text: "Team Phobos, from the THEMIS thermal inertia, TES albedo, terrain, REMS and Mastcam τ data above. A heuristic, not a probability." }],
    },
    {
      title: "STREET LEVEL",
      credit: "Imagery: NASA/JPL-Caltech/MSSS",
      lines: [{ text: "Five Curiosity rover panoramas (Navcam and Mastcam) from NASA's Photojournal.", url: "https://science.nasa.gov/photojournal" }],
    },
  ];
}
