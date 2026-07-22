#!/usr/bin/env python3
"""Validate the public Tagalog Academy repository using the Python standard library."""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "index.html",
    "README.md",
    "CNAME",
    ".nojekyll",
    "manifest.webmanifest",
    "service-worker.js",
    "requirements-dev.txt",
    "assets/css/styles.css",
    "assets/js/app.js",
    "data/course.json",
    "data/lesson.schema.json",
    "data/lessons/week1.json",
    "data/lessons/week2.json",
    "data/lessons/week3.json",
    "data/lessons/week4.json",
    "scripts/validate_schema.py",
    "tests/test_app_logic.mjs",
    "VV-REMEDIATION-v3.0.1.md",
]
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".md", ".txt", ".yml", ".yaml", ".webmanifest", ".mjs"}
BANNED_PUBLIC_TEXT = [
    "Jeepney School",
    "JeepneySchool",
    "us06web.zoom.us",
    "docs.google.com/forms",
    "forms.gle/",
]
STANDARD_11_TO_19 = {
    "eleven": "Labing-isa",
    "twelve": "Labindalawa",
    "thirteen": "Labintatlo",
    "fourteen": "Labing-apat",
    "fifteen": "Labinlima",
    "sixteen": "Labing-anim",
    "seventeen": "Labimpito",
    "eighteen": "Labingwalo",
    "nineteen": "Labinsiyam",
}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for attr in ("href", "src"):
            value = values.get(attr)
            if value:
                self.links.append(value)


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def load_json(path: Path, errors: list[str]) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Could not parse {path.relative_to(ROOT)}: {exc}", errors)
        return {}


def validate_lesson(path: Path, expected_version: str, errors: list[str]) -> dict:
    data = load_json(path, errors)
    required = [
        "version", "id", "week", "title", "objectives", "vocabulary",
        "grammar_notes", "builders", "quiz", "missions", "resources",
    ]
    for key in required:
        if key not in data:
            fail(f"{path.name}: missing key {key}", errors)

    if data.get("version") != expected_version:
        fail(f"{path.name}: version must match course version {expected_version}", errors)

    vocabulary = data.get("vocabulary", [])
    ids = [item.get("id") for item in vocabulary]
    if len(vocabulary) < 25:
        fail(f"{path.name}: expected at least 25 vocabulary records", errors)
    if len(ids) != len(set(ids)):
        fail(f"{path.name}: duplicate vocabulary IDs", errors)
    if any(not item.get("tagalog") or not item.get("english") or not item.get("category") for item in vocabulary):
        fail(f"{path.name}: incomplete vocabulary record", errors)

    quiz = data.get("quiz", [])
    if len(quiz) != 10:
        fail(f"{path.name}: expected exactly 10 quiz questions", errors)
    for index, item in enumerate(quiz, start=1):
        choices = item.get("choices", [])
        answer = item.get("answer")
        if len(choices) < 3:
            fail(f"{path.name}: quiz {index} needs at least 3 choices", errors)
        if len(choices) != len(set(choices)):
            fail(f"{path.name}: quiz {index} has duplicate choices", errors)
        if not isinstance(answer, int) or answer < 0 or answer >= len(choices):
            fail(f"{path.name}: quiz {index} has invalid answer index", errors)

    if len(data.get("builders", [])) < 2:
        fail(f"{path.name}: expected at least 2 builders", errors)
    if len(data.get("missions", [])) < 2:
        fail(f"{path.name}: expected at least 2 missions", errors)

    for resource in data.get("resources", []):
        url = resource.get("url", "")
        if not url:
            fail(f"{path.name}: resource missing URL", errors)
        elif url.startswith(("http://", "https://")):
            if urlparse(url).scheme != "https":
                fail(f"{path.name}: external resource must use HTTPS: {url}", errors)
        elif not (ROOT / url).exists():
            fail(f"{path.name}: missing internal resource {url}", errors)

    return data


def main() -> int:
    errors: list[str] = []

    for relative in REQUIRED:
        if not (ROOT / relative).exists():
            fail(f"Missing required file: {relative}", errors)

    cname = ROOT / "CNAME"
    if cname.exists() and cname.read_text(encoding="utf-8").strip() != "tagalog.academy":
        fail("CNAME must contain tagalog.academy", errors)

    course_path = ROOT / "data" / "course.json"
    course = load_json(course_path, errors) if course_path.exists() else {}
    version = course.get("version", "")
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        fail("Course version must use semantic versioning", errors)

    available = [week for week in course.get("weeks", []) if week.get("status") == "available"]
    if len(available) != 4:
        fail("Course must expose exactly four available weeks", errors)

    lessons: dict[str, dict] = {}
    for week in available:
        file_path = ROOT / week.get("file", "")
        if not file_path.exists():
            fail(f"Course points to missing lesson: {week.get('file')}", errors)
            continue
        lessons[week.get("id", file_path.stem)] = validate_lesson(file_path, version, errors)

    week4 = lessons.get("week4", {})
    number_map = {item.get("id"): item.get("tagalog") for item in week4.get("vocabulary", [])}
    for item_id, spelling in STANDARD_11_TO_19.items():
        if number_map.get(item_id) != spelling:
            fail(f"week4.json: {item_id} must display as {spelling}", errors)

    parser = LinkParser()
    index_path = ROOT / "index.html"
    if index_path.exists():
        parser.feed(index_path.read_text(encoding="utf-8"))
    for link in parser.links:
        if link.startswith(("#", "mailto:", "tel:", "http://", "https://", "data:")):
            continue
        clean = link.split("#", 1)[0].split("?", 1)[0]
        if clean and not (ROOT / clean).exists():
            fail(f"index.html references missing local file: {clean}", errors)

    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for banned in BANNED_PUBLIC_TEXT:
            if banned.lower() in text.lower():
                fail(f"Public repository contains excluded text '{banned}' in {path.relative_to(ROOT)}", errors)

    app_js = (ROOT / "assets/js/app.js").read_text(encoding="utf-8") if (ROOT / "assets/js/app.js").exists() else ""
    for required_code in (
        "document.readyState === 'complete'",
        "addEventListener('load', register, {once: true})",
        "voiceschanged",
        "No Filipino voice is installed on this device",
        "getBoundingClientRect().height",
    ):
        if required_code not in app_js:
            fail(f"app.js is missing required V&V remediation: {required_code}", errors)
    if "offsetTop - 92" in app_js:
        fail("app.js still contains the hardcoded panel scroll offset", errors)

    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8") if (ROOT / "service-worker.js").exists() else ""
    for required_cache in ("data/course.json", "week1.json", "week2.json", "week3.json", "week4.json"):
        if required_cache not in sw:
            fail(f"Service worker does not cache {required_cache}", errors)
    expected_cache = f"tagalog-academy-v{version}"
    if expected_cache not in sw:
        fail(f"Service-worker cache name must match {expected_cache}", errors)

    license_text = (ROOT / "LICENSE").read_text(encoding="utf-8") if (ROOT / "LICENSE").exists() else ""
    if "Tagalog Academy contributors" not in license_text:
        fail("LICENSE must use current Tagalog Academy branding", errors)

    workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8") if (ROOT / ".github/workflows/ci.yml").exists() else ""
    if "scripts/validate_schema.py" not in workflow or "requirements-dev.txt" not in workflow:
        fail("CI must install dev requirements and enforce lesson schema validation", errors)

    vv_report = (ROOT / "UX-VV-REPORT.md").read_text(encoding="utf-8") if (ROOT / "UX-VV-REPORT.md").exists() else ""
    if "Workbook links mapped | 37" in vv_report:
        fail("UX V&V report still contains the unsubstantiated workbook-link count", errors)

    if errors:
        print("VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("VALIDATION PASSED")
    print(f"- release version {version}")
    print("- 4 available weeks")
    print("- lesson data, quizzes, builders, missions, and resources validated")
    print("- independent P1/P2 remediation checks passed")
    print("- private class administration links excluded")
    print("- custom domain, cache version, and offline assets configured")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
