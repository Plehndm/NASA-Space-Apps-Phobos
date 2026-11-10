# Literature Check: REMS-Derived Thermal Inertia Along the Traverse

Checked Nov 10, 2026. Units: tiu = J m^-2 K^-1 s^-1/2. No notebooks were rerun; our numbers come from `progress.md` (Session 2e, Session 2d) and `discoveries.md`.

## Question

Our fits say REMS ground temperatures behave like ground of about 330-400 tiu in every block, whatever THEMIS says (THEMIS block means 386-637 tiu; implied TI 328-401 tiu). The baseline uses `ti_scale` 0.74 x THEMIS 100 m TI. Does the published work on REMS ground-temperature (GTS) thermal inertia agree? And does it support the scale and the caveat that most of the map is outside the rover's TI range?

## Sources (verified)

Each DOI was resolved or its record read (Crossref, OpenAlex, NASA NTRS, PMC or arXiv) on the date above.

1. Hamilton, V. E., Vasavada, A. R., Sebastián, E., de la Torre Juárez, M., Ramos, M., Armiens, C., et al. (2014). Observations and preliminary science results from the first 100 sols of MSL Rover Environmental Monitoring Station ground temperature sensor measurements at Gale Crater. *JGR Planets*, 119(4), 745-770. https://doi.org/10.1002/2013JE004520 (abstract read; full text not read, paywalled).
2. Martínez, G. M., Rennó, N., Fischer, E., Borlina, C. S., Hallet, B., de la Torre Juárez, M., Vasavada, A. R., Ramos, M., Hamilton, V., Gomez-Elvira, J., & Haberle, R. M. (2014). Surface energy budget and thermal inertia at Gale Crater: Calculations from ground-based measurements. *JGR Planets*, 119(8), 1822-1838. https://doi.org/10.1002/2014JE004618 (full text read, open access: PMC4508907).
3. Vasavada, A. R., Piqueux, S., Lewis, K. W., Lemmon, M. T., & Smith, M. D. (2017). Thermophysical properties along Curiosity's traverse in Gale crater, Mars, derived from the REMS ground temperature sensor. *Icarus*, 284, 372-386. https://doi.org/10.1016/j.icarus.2016.11.035 (abstract read via NASA NTRS 20170003773; full text not read, paywalled).
4. Edwards, C. S., Piqueux, S., Hamilton, V. E., Fergason, R. L., Herkenhoff, K. E., Vasavada, A. R., et al. (2018). The thermophysical properties of the Bagnold Dunes, Mars: Ground-truthing orbital data. *JGR Planets*, 123(5), 1307-1326. https://doi.org/10.1029/2017JE005501 (full text read from the arXiv preprint, arXiv:1711.10699; numbers may differ slightly from the published version).
5. Hamilton, V., Vasavada, A., Christensen, P., Ramos, M., & de Pablo, M. A. (2014). Simultaneous MSL REMS and Mars Odyssey THEMIS ground temperature measurements in Gale crater, Mars. EGU General Assembly 2014, *Geophysical Research Abstracts* 16, EGU2014-3134 (conference abstract, read in full; no DOI).

Cited only second-hand (through source 2): Fergason, R. L., et al. (2012), *Space Sci. Rev.*, 170, 739-773, https://doi.org/10.1007/s11214-012-9891-3. The DOI and metadata are verified; the value below was not checked in the paper itself.

## What they report

| Source | Where, when | TI (tiu) | Method and caveats |
|---|---|---|---|
| Hamilton et al. 2014 | Bradbury Landing to Rocknest, sols 1-100 | 265-375 | Single-TI thermal model fitted to diurnal amplitude. Ground warms earlier and cools later than the model; loose dust and fines over rockier ground are a likely cause. |
| Martínez et al. 2014 | Rocknest (sol 82); Point Lake (sol 112); Yellowknife Bay (sol 139) | 295 +- 37; 306 +- 38; 452 +- 50 | Homogeneous 1D conduction with GTS temperature as the upper boundary. Albedo 0.20-0.25 (TES); total error about 12%. GTS field of view about 100 m^2, half the signal from the near field; RTG may warm readings by up to about 4 K. |
| Vasavada et al. 2017 | Traverse, about two Mars years | Bedrock-dominated surfaces about 350-550 (apparent); with lateral and vertical mixing, bedrock itself 650-1700 (mudstone), about 700 (sandstone) | Apparent TI and thermally derived albedo; water-ice cloud radiation included. REMS separates active sand, loose material, mudstone and sandstone. Authors call the mixing results possibly non-unique. Per-site values not read (paywalled). |
| Edwards et al. 2018 | Namib dune, Bagnold Dunes, sols 1222-1242 | GTS 170-200; THEMIS main dune field 240 +- 20 (range 200-310) | Plane and facet models; albedo left free (0.07-0.13, below orbital 0.15). THEMIS over Namib itself is mixed with Murray and Stimson bedrock, which raises orbital TI. |
| Hamilton et al. 2014 (EGU) | GTS vs THEMIS through sol 414 | No numbers | "THEMIS thermal inertias appear to be somewhat higher than their GTS-derived counterparts overall", mostly from resolution differences (Rocknest sand shadow, Glenelg). |
| Fergason et al. 2012 (via Martínez 2014) | Landing ellipse, THEMIS | 365 +- 50 | Not checked in the original. |

## Comparison with our model

- **Magnitude agrees.** Our implied 328-401 tiu sits inside the published GTS range: above loose sand (170-300), at the low end of Vasavada's bedrock-dominated 350-550, and close to Martínez's three sites (295-452).
- **Block 0 agrees best.** Block 0 (sols 1-170, Bradbury) implies about 350 tiu against a THEMIS mean of 637. Hamilton (265-375, sols 1-100) and Martínez (295-452, sols 82-139) cover the same sols and land on the same value, not on THEMIS.
- **The direction of the THEMIS gap agrees.** The EGU abstract says THEMIS TI is somewhat higher than GTS TI overall. Our scale 0.74 (fits 0.69-0.88) says the same.
- **The cause they give is not a THEMIS bias.** Both Hamilton papers and Edwards put the gap down to footprint size (GTS about 100 m^2 vs a 100 m THEMIS pixel) and sub-pixel mixing of sand with bedrock, plus loose surface layers. Vasavada finds even bedrock reads as 350-550 apparent tiu for the same reasons. A gap of this kind depends on what each pixel contains. It is not a fixed fraction.
- **REMS does see variation that our blocks do not.** Vasavada reports that GTS separates sand, loose material, mudstone and sandstone, and Edwards gets 170-200 tiu on Namib dune. Our 330-400 tiu in every block is a block-mean fit with `g_diff` and `f_ir` held global. It probably averages over mixed terrain within each block, so it hides real variation along the traverse.
- **On low-TI ground the scale happens to work once.** At the dunes, 0.74 x THEMIS 240 = 178 tiu, inside the GTS 170-200. This is one site. Edwards also says orbital TI is reliable for uniform materials, so this is not evidence that the scale belongs on uniform ground.

## Conclusion and implications

**Partly consistent.** The published REMS-derived TI agrees with our implied 330-400 tiu in magnitude and agrees that THEMIS reads higher than GTS, most strongly at Bradbury (block 0). It does not support the form of our correction. The literature explains the gap through footprint mixing and loose surface layers, which vary from place to place. A single multiplicative scale over the whole crater is a convenience, not something these papers back.

For the model:

- `ti_scale` < 1 is supported at the rover, and the block 0 diagnostic (about 350 tiu, not 637) is backed by two independent papers covering the same sols.
- Applying 0.74 everywhere is not supported. On uniform ground, such as dune fields and dust-mantled plains, THEMIS should already be close to right, and the scale would make it too low. On mixed pixels the right correction depends on the mix. No source gives a crater-wide correction.
- The caveat "most of the map is outside the rover's TI range" stands and should be kept. Real ground below 330 tiu exists along the traverse (sand 170-200, Rocknest 295), but our training blocks do not resolve it, so our model was not tested there.
- The two-layer proposal in `plan.md` (block 0's remaining shape error) fits the literature. Hamilton's "warms earlier, cools later" and Vasavada's vertical mixing point to the same layered-surface effect.

## What's still unverified

- Vasavada et al. 2017: per-site TI values, sols and units. Only the abstract was read.
- Hamilton et al. 2014 (JGR): per-site values, albedo used, GTS footprint handling. Only the abstract was read. The value "about 300 tiu at Rocknest" comes through Martínez 2014.
- Fergason et al. 2012: the 365 +- 50 tiu for the landing ellipse. Read only as quoted in Martínez 2014.
- Edwards et al. 2018: numbers come from the arXiv preprint, not the published version.
- Which of our training blocks cover dune or sand sols (for example sols 1162-1242, Bagnold campaign). Block sol ranges other than 0, 4 and 8 are not in the docs, so this was not checked.
- Martínez et al. 2021 (JGR Planets, https://doi.org/10.1029/2020JE006804, verified) covers the surface energy budget for the first 2500 sols. Its abstract gives no TI values; the full text was not read.
