"""Project paths. Every other module and notebook takes its paths from here."""
from pathlib import Path

HEATMAP_DIR = Path(__file__).resolve().parent           # heatmap/: this project's code, notebooks, tests and outputs
REPO_ROOT = HEATMAP_DIR.parent
DATA_DIR = REPO_ROOT / "processed_data"
assert DATA_DIR.is_dir(), f"data folder not found: {DATA_DIR}"

# heatmap/outputs/ (git-ignored); maps explained in heatmap/outputs/maps/README.md
OUTPUTS_DIR = HEATMAP_DIR / "outputs"
SCORES_DIR = OUTPUTS_DIR / "model_scores"                # model development and testing, in pipeline order
OUT_DIR = SCORES_DIR / "1_physics_baseline"              # Steps 3-4
RESIDUAL_OUT_DIR = SCORES_DIR / "2_ground_correction"    # Step 5
TI_SENS_OUT_DIR = SCORES_DIR / "3_ti_sensitivity"
BLOCK0_OUT_DIR = SCORES_DIR / "4_block0_diagnostic"
AIR_OUT_DIR = SCORES_DIR / "5_air_model"                 # Step 5b
SEALED_OUT_DIR = SCORES_DIR / "6_sealed_test"            # Step 7
MAPS_DIR = OUTPUTS_DIR / "maps"                          # the deliverables
MAP_OUT_DIR = MAPS_DIR / "ground"                        # Step 6
AIR_MAP_OUT_DIR = MAPS_DIR / "air"                       # Step 6b
