#!/usr/bin/env python3
"""Validate all lesson JSON files against the published lesson schema."""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    print("ERROR: jsonschema is required. Run: python -m pip install -r requirements-dev.txt", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "data" / "lesson.schema.json"
LESSON_DIR = ROOT / "data" / "lessons"


def main() -> int:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    errors_found = False

    for path in sorted(LESSON_DIR.glob("week*.json")):
        instance = json.loads(path.read_text(encoding="utf-8"))
        errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.absolute_path))
        if errors:
            errors_found = True
            for error in errors:
                location = ".".join(str(part) for part in error.absolute_path) or "<root>"
                print(f"{path.relative_to(ROOT)}:{location}: {error.message}")
        else:
            print(f"SCHEMA PASS: {path.relative_to(ROOT)}")

    return 1 if errors_found else 0


if __name__ == "__main__":
    raise SystemExit(main())
