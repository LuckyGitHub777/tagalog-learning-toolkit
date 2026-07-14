#!/usr/bin/env python3
"""Small dependency-free companion CLI for the Tagalog Learning Toolkit."""
from __future__ import annotations

import argparse
import json
import random
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
LESSON_PATH = ROOT / "data" / "lessons" / "week1.json"


def load_lesson(path: Path = LESSON_PATH) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"Lesson not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def validate_lesson(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = {"version", "id", "title", "vocabulary", "adjectives", "quiz"}
    missing = sorted(required - data.keys())
    if missing:
        errors.append(f"Missing top-level keys: {', '.join(missing)}")

    vocabulary = data.get("vocabulary", [])
    ids: list[str] = []
    for index, item in enumerate(vocabulary):
        for key in ("id", "category", "tagalog", "english", "accepted"):
            if key not in item:
                errors.append(f"vocabulary[{index}] is missing {key}")
        if "id" in item:
            ids.append(str(item["id"]))
        if not isinstance(item.get("accepted", []), list):
            errors.append(f"vocabulary[{index}].accepted must be a list")
    duplicates = sorted({item_id for item_id in ids if ids.count(item_id) > 1})
    if duplicates:
        errors.append(f"Duplicate vocabulary IDs: {', '.join(duplicates)}")

    for index, item in enumerate(data.get("quiz", [])):
        choices = item.get("choices", [])
        answer = item.get("answer")
        if not isinstance(choices, list) or len(choices) < 2:
            errors.append(f"quiz[{index}] must have at least two choices")
        if not isinstance(answer, int) or not 0 <= answer < len(choices):
            errors.append(f"quiz[{index}] has an out-of-range answer index")

    required_terms = {"mother", "father", "older-brother", "older-sister", "youngest", "cousin"}
    missing_terms = sorted(required_terms - set(ids))
    if missing_terms:
        errors.append(f"Missing required family terms: {', '.join(missing_terms)}")
    return errors


def cmd_validate(_: argparse.Namespace) -> int:
    data = load_lesson()
    errors = validate_lesson(data)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(
        f"PASS: {len(data['vocabulary'])} vocabulary items, "
        f"{len(data['adjectives'])} adjectives, and {len(data['quiz'])} quiz questions validated."
    )
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    handler = lambda *a, **kw: SimpleHTTPRequestHandler(*a, directory=str(ROOT), **kw)  # noqa: E731
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving Tagalog Learning Toolkit at http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
    return 0


def study_items(data: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item for item in data["vocabulary"]
        if item.get("accepted") and "____" not in item.get("tagalog", "")
    ]


def cmd_study(args: argparse.Namespace) -> int:
    data = load_lesson()
    items = study_items(data)
    rng = random.Random(args.seed)
    rng.shuffle(items)
    selected = items[: min(args.count, len(items))]
    if args.preview or not sys.stdin.isatty():
        for number, item in enumerate(selected, 1):
            print(f"{number:>2}. {item['english']} -> {item['tagalog']}")
        return 0

    score = 0
    print(f"\n{data['title']} — terminal recall session\n")
    for number, item in enumerate(selected, 1):
        input(f"{number}/{len(selected)}  {item['english']}\nPress Enter to reveal: ")
        print(f"Answer: {item['tagalog']}")
        response = input("Did you recall it? [y/N] ").strip().lower()
        if response in {"y", "yes"}:
            score += 1
        print()
    print(f"Session score: {score}/{len(selected)}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tagalog.py",
        description="Validate, serve, or study the Tagalog Learning Toolkit.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser("validate", help="Validate lesson content")
    validate.set_defaults(func=cmd_validate)

    serve = subparsers.add_parser("serve", help="Run the website locally")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", default=8000, type=int)
    serve.set_defaults(func=cmd_serve)

    study = subparsers.add_parser("study", help="Run a terminal recall session")
    study.add_argument("--count", type=int, default=10)
    study.add_argument("--seed", type=int, default=None)
    study.add_argument("--preview", action="store_true", help="Print prompts and answers without interaction")
    study.set_defaults(func=cmd_study)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
