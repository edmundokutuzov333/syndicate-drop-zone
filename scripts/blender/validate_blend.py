#!/usr/bin/env python3
"""Validate a saved Blender source scene against the committed Scene Bible."""
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes, validate_scene_contract

def main():
    args = argv_after_dashes()
    bible_path = Path(args[0] if args else "docs/camping-v3/scene-bible.json").resolve()
    if not bible_path.is_file():
        raise FileNotFoundError("Scene Bible not found: " + str(bible_path))
    bible = json.loads(bible_path.read_text(encoding="utf-8"))
    report = validate_scene_contract(bible, bpy.data.filepath)
    print("CAMPING BLEND CONTRACT OK", json.dumps(report, sort_keys=True))

if __name__ == "__main__":
    import bpy
    main()
