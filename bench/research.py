"""Repository entry point for study planning, reduction, analysis and packaging."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "agent"))
from spillguard.repro.research_cli import main

if __name__ == "__main__":
    sys.exit(main())
