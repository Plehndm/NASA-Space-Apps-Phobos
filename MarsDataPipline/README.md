# Gale Crater temperature maps (NASA Space Apps 2026)

Modelled ground and near-surface air temperature for Gale Crater, Mars, for the challenge "Interplanetary Survival Guide: Martian Map". The maps cover 5 seasons, with a frame every 30 minutes of local time, on a grid of about 200 m.

## I want to...

| Goal | Go to |
|---|---|
| Look at or use the maps | `outputs/maps/README.md`: ground temperature in `outputs/maps/ground/`, air temperature in `outputs/maps/air/` |
| Find a model score or figure | `outputs/README.md`: headline numbers and where each one lives |
| Understand the model and its limits | `docs/progress.md` (newest first), `docs/discoveries.md` |
| See what was tried and rejected | `docs/closed_ideas.md` |
| See what comes next | `docs/plan.md` |
| Get the background | `docs/Handover Brief Gale Crater Temperature Heatmap (Oct 26).md`, `docs/Gale Crater Diurnal Temperature Model Plan Summary.pdf` |
| Work on the code | `CLAUDE.md`: rules, physics spec, environment, commands |

## Folders

```
MarsDataPipeline/
  README.md          this file
  CLAUDE.md          project rules and spec; read before changing code
  thermal1d.py       1D soil heat-conduction model (the physics baseline)
  residual.py        statistical correction models (ground and air)
  map_export.py      builds and encodes the full-crater maps
  paths.py           every folder path the code uses
  tests/             solver and forcing tests (Gates 1 and 2)
  notebooks/         the temperature-model notebooks, in the order they were built (see below)
  executed/          run copies of those notebooks, with their outputs
  outputs/           results (not in git): maps/ (the deliverables) and model_scores/ (how the models were tested); see outputs/README.md
  processed_data/    model inputs: REMS training table, terrain rasters, feature table (read-only, not in git)
  raw_data/          original downloads: REMS files, THEMIS, TES albedo, Mastcam tau (not in git)
  data_prep/         notebooks that turned raw_data/ into processed_data/
  dust_devil/        the dust devil likelihood layer (parked); has its own README
  gale_tiles/        web-map tiles (imagery and hillshade) and the source DTMs; has its own README
  docs/              plans, progress log, findings, briefs
  _Trash_Review/     files set aside for deletion, waiting for review (not in git; see below)
  gale-env/          the Python environment (not in git; never edit)
```

## Results in one paragraph

Ground temperature = a physics model run per pixel + a correction fitted to Curiosity's REMS readings. Air temperature = a statistical model of time, season, dust and the predicted ground. At the rover, ground scores about 4.9 K RMSE in leave-one-block-out tests and 5.3 K on the sealed test blocks; air scores about 4.1 K. Neither clearly beats a simple seasonal average of the REMS readings. Accuracy away from the rover is not measured, because all REMS data comes from an area of about 10 x 5 km. Night air on the map is nearly uniform across the crater, which is a limitation of the model, not physics. Details and caveats: `outputs/maps/README.md`.

## Running things

Windows, from this folder, in Git Bash. Always use the project environment by path:

```bash
# tests
gale-env/Scripts/python.exe -m pytest tests -q

# run a notebook into executed/
gale-env/Scripts/jupyter.exe nbconvert --to notebook --execute notebooks/<name>.ipynb \
  --output-dir executed --ExecutePreprocessor.timeout=3600 --ExecutePreprocessor.kernel_name=gale-env
```

Notebook order in `notebooks/`: `baseline_diagnostic`, `baseline_fit_lobo`, `residual_lobo`, `residual_flann_lobo`, `ti_sensitivity_lobo`, `block0_diagnostic`, `map_run` (ground map), `air_lobo`, `air_map_run` (air map), `sealed_test`.

The notebooks in `data_prep/`, `dust_devil/` and `gale_tiles/` use paths relative to their own folder (for example `../processed_data`), so open or run them from where they are.
