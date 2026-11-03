# Gale Crater temperature maps (NASA Space Apps 2026)

Modelled ground and near-surface air temperature for Gale Crater, Mars, for the challenge "Interplanetary Survival Guide: Martian Map". The maps cover 5 seasons, with a frame every 30 minutes of local time, on a grid of about 200 m.

## I want to...

| Goal | Go to |
|---|---|
| Look at or use the maps | The Google Drive folder linked in `processed_data/Google_Drive`: ground and air temperature maps, model inputs and map tiles |
| Find a model score or figure | `heatmap/outputs/model_scores/` (in the Google Drive folder): one folder per model step, numbered in pipeline order |
| See the dust devil layer | `dust_devil/README.md`; its maps, overlays and GIFs are written to `dust_devil/outputs/` |
| Understand the model and its limits | `docs/progress.md` (newest first), `docs/discoveries.md` |
| See what was tried and rejected | `docs/closed_ideas.md` |
| See what comes next | `docs/plan.md` |
| Get the background | `docs/1D Thermal Baseline Build Steps.md`, `docs/Gale Crater Diurnal Temperature Model Plan Summary.pdf` |
| Work on the code | `CLAUDE.md`: rules, physics spec, environment, commands |

## Folders

Each project has its own folder with the same layout: code, notebooks, tests, `executed/` (run copies of the notebooks) and `outputs/` (results, not in git). The shared inputs stay at the top.

```
MarsDataPipeline/
  README.md          this file
  CLAUDE.md          project rules and spec; read before changing code
  heatmap/           the temperature maps (ground and air)
    thermal1d.py       1D soil heat-conduction model (the physics baseline)
    residual.py        statistical correction models (ground and air)
    map_export.py      builds and encodes the full-crater maps
    paths.py           every folder path the code uses
    pytest.ini         test settings
    tests/             solver and forcing tests (Gates 1 and 2)
    notebooks/         the temperature-model notebooks, in the order they were built (see below)
    executed/          run copies of those notebooks, with their outputs (not in git)
    outputs/           results (not in git): maps/ (the deliverables) and model_scores/ (how the models were tested)
  dust_devil/        the Dust Devil Heating Index layer (parked); has its own README
    dust_devil_pipeline.ipynb   the pipeline notebook
    dev/, tests/       iteration scripts and tests
    executed/          run copy of the notebook (not in git)
    outputs/           per-sol maps, overlays, rover tables, summary CSVs and GIFs (not in git)
  processed_data/    Google Drive link: model inputs, map tiles and heat-map outputs
  raw_data/          citation list: REMS files, THEMIS, TES albedo, Mastcam tau (the downloads are not in git)
  data_prep/         notebooks that turned raw_data/ into processed_data/
  gale_tiles/        web-map tiles (imagery and hillshade) and the source DTMs; has its own README
  docs/              plans, progress log, findings, briefs
```

## Results in one paragraph

Ground temperature = a physics model run per pixel + a correction fitted to Curiosity's REMS readings. Air temperature = a statistical model of time, season, dust and the predicted ground. At the rover, ground scores about 4.9 K RMSE in leave-one-block-out tests and 5.3 K on the sealed test blocks; air scores about 4.1 K. Neither clearly beats a simple seasonal average of the REMS readings. Accuracy away from the rover is not measured, because all REMS data comes from an area of about 10 x 5 km. Night air on the map is nearly uniform across the crater, which is a limitation of the model, not physics. Details and caveats: `heatmap/outputs/maps/README.md` (in the Google Drive folder).

## Running things

Windows, from this folder, in Git Bash. Always use the project environment by path:

```bash
# heat-map tests
gale-env/Scripts/python.exe -m pytest heatmap -q

# dust devil tests (add -m "not realdata" to skip the 3 slow real-data tests)
gale-env/Scripts/python.exe -m pytest dust_devil/tests -q

# run a heat-map notebook into heatmap/executed/
gale-env/Scripts/python.exe -m nbconvert --to notebook --execute heatmap/notebooks/<name>.ipynb \
  --output-dir heatmap/executed --ExecutePreprocessor.timeout=3600 --ExecutePreprocessor.kernel_name=gale-env
```

Notebook order in `heatmap/notebooks/`: `baseline_diagnostic`, `baseline_fit_lobo`, `residual_lobo`, `residual_flann_lobo`, `ti_sensitivity_lobo`, `block0_diagnostic`, `map_run` (ground map), `air_lobo`, `air_map_run` (air map), `sealed_test`.

The notebooks in `data_prep/`, `dust_devil/` and `gale_tiles/` use paths relative to their own folder (for example `../processed_data`), so open or run them from where they are.
