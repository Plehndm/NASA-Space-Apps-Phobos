import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "dev"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import dd_synth  # noqa: E402


def pytest_configure(config):
    config.addinivalue_line("markers", "realdata: reads processed_data/ (slow, about 2.5 GB for the sol-800 run)")


@pytest.fixture
def grid():
    return dd_synth.make_grid()


@pytest.fixture
def ms():
    import multisol
    return multisol
