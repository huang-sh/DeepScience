#!/usr/bin/env python3
"""Run the shared catalog engine for Biological Knowledge."""

import os
import runpy
from pathlib import Path

RESOURCE_ROOT = Path(__file__).resolve().parent.parent
os.environ["DEEPSCIENCE_RESOURCE_ROOT"] = str(RESOURCE_ROOT)
runpy.run_path(str(RESOURCE_ROOT.parents[1] / "catalog" / "catalog.py"), run_name="__main__")
