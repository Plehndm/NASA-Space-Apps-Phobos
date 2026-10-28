"""Project paths. Every other module and notebook takes its paths from here."""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
DATA_DIR = REPO_ROOT / "processed_data"
OUT_DIR = REPO_ROOT / "outputs" / "baseline"

assert DATA_DIR.is_dir(), f"data folder not found: {DATA_DIR}"
