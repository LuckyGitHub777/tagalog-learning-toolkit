#!/usr/bin/env python3
"""Local tools for Tagalog Academy.

Commands:
  python tagalog.py validate
  python tagalog.py serve --port 8000
  python tagalog.py study --week 2 --count 10
"""

from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LESSON_DIR = ROOT / "data" / "lessons"


def load_lesson(week: int) -> dict:
    path = LESSON_DIR / f"week{week}.json"
    if not path.exists():
        raise SystemExit(f"Week {week} is not available.")
    return json.loads(path.read_text(encoding="utf-8"))


def validate() -> int:
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate_repo.py")],
        cwd=ROOT,
        check=False,
    )
    schema_code = 0
    try:
        import jsonschema  # noqa: F401
    except ImportError:
        print("Schema validation skipped locally; install requirements-dev.txt to run it. CI always enforces it.")
    else:
        schema = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_schema.py")],
            cwd=ROOT,
            check=False,
        )
        schema_code = schema.returncode

    tests = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
        cwd=ROOT,
        check=False,
    )
    return 0 if result.returncode == 0 and schema_code == 0 and tests.returncode == 0 else 1


def serve(port: int) -> None:
    class Handler(SimpleHTTPRequestHandler):
        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-cache")
            super().end_headers()

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Tagalog Academy is running at http://127.0.0.1:{port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


def study(week: int, count: int) -> None:
    lesson = load_lesson(week)
    candidates = [
        item for item in lesson["vocabulary"]
        if item.get("tagalog") and "____" not in item["tagalog"]
    ]
    random.shuffle(candidates)

    for index, item in enumerate(candidates[:count], start=1):
        print(f"\n{index}. {item['english']}")
        input("   Press Enter to reveal...")
        print(f"   {item['tagalog']}")
        if item.get("note"):
            print(f"   Note: {item['note']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Tagalog Academy local tools")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("validate", help="Run repository validation and tests")

    serve_parser = subparsers.add_parser("serve", help="Serve the website locally")
    serve_parser.add_argument("--port", type=int, default=8000)

    study_parser = subparsers.add_parser("study", help="Run a terminal recall session")
    study_parser.add_argument("--week", type=int, default=1, choices=range(1, 5))
    study_parser.add_argument("--count", type=int, default=10)

    args = parser.parse_args()

    if args.command == "validate":
        return validate()
    if args.command == "serve":
        serve(args.port)
        return 0
    if args.command == "study":
        study(args.week, max(1, args.count))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
