from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class TagalogAcademyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.course = json.loads((ROOT / "data/course.json").read_text(encoding="utf-8"))
        cls.lessons = {
            week["id"]: json.loads((ROOT / week["file"]).read_text(encoding="utf-8"))
            for week in cls.course["weeks"]
            if week["status"] == "available"
        }

    def test_release_version_is_consistent(self) -> None:
        self.assertEqual("3.0.1", self.course["version"])
        for lesson in self.lessons.values():
            self.assertEqual(self.course["version"], lesson["version"])

    def test_four_available_weeks(self) -> None:
        self.assertEqual(4, len(self.lessons))

    def test_week_numbers_are_sequential(self) -> None:
        self.assertEqual([1, 2, 3, 4], [self.lessons[f"week{i}"]["week"] for i in range(1, 5)])

    def test_vocabulary_ids_are_unique_within_each_week(self) -> None:
        for lesson in self.lessons.values():
            ids = [item["id"] for item in lesson["vocabulary"]]
            self.assertEqual(len(ids), len(set(ids)), lesson["id"])

    def test_every_week_has_substantial_content(self) -> None:
        for lesson in self.lessons.values():
            self.assertGreaterEqual(len(lesson["vocabulary"]), 25, lesson["id"])
            self.assertGreaterEqual(len(lesson["objectives"]), 4, lesson["id"])
            self.assertGreaterEqual(len(lesson["grammar_notes"]), 2, lesson["id"])
            self.assertEqual(10, len(lesson["quiz"]), lesson["id"])
            self.assertGreaterEqual(len(lesson["builders"]), 2, lesson["id"])
            self.assertGreaterEqual(len(lesson["missions"]), 2, lesson["id"])

    def test_quiz_answers_are_valid_and_choices_unique(self) -> None:
        for lesson in self.lessons.values():
            for item in lesson["quiz"]:
                self.assertIsInstance(item["answer"], int)
                self.assertGreaterEqual(item["answer"], 0)
                self.assertLess(item["answer"], len(item["choices"]))
                self.assertEqual(len(item["choices"]), len(set(item["choices"])))

    def test_internal_resources_exist(self) -> None:
        for lesson in self.lessons.values():
            for resource in lesson["resources"]:
                url = resource["url"]
                if not re.match(r"^https://", url):
                    self.assertTrue((ROOT / url).exists(), url)

    def test_public_text_excludes_private_course_operations(self) -> None:
        corpus = []
        for path in ROOT.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".html", ".js", ".css", ".json", ".md", ".yml", ".yaml"}:
                corpus.append(path.read_text(encoding="utf-8", errors="replace"))
        text = "\n".join(corpus).lower()
        self.assertNotIn("us06web.zoom.us", text)
        self.assertNotIn("docs.google.com/forms", text)
        self.assertNotIn("jeepneyschool", text.replace(" ", ""))

    def test_custom_domain_is_preserved(self) -> None:
        self.assertEqual("tagalog.academy", (ROOT / "CNAME").read_text(encoding="utf-8").strip())

    def test_service_worker_registration_handles_late_initialization(self) -> None:
        app = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
        self.assertIn("document.readyState === 'complete'", app)
        self.assertIn("addEventListener('load', register, {once: true})", app)

    def test_tts_discloses_missing_filipino_voice(self) -> None:
        app = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("voiceschanged", app)
        self.assertIn("No Filipino voice is installed on this device", app)
        self.assertIn("without an installed Filipino voice", html)
        self.assertIn('id="app-feedback"', html)

    def test_service_worker_cache_matches_release(self) -> None:
        sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertIn(f"tagalog-academy-v{self.course['version']}", sw)
        for week in range(1, 5):
            self.assertIn(f"week{week}.json", sw)

    def test_manifest_is_installable(self) -> None:
        manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual("standalone", manifest["display"])
        self.assertEqual("./", manifest["start_url"])
        self.assertGreaterEqual(len(manifest["icons"]), 2)

    def test_schema_validation_is_enforced_in_ci(self) -> None:
        workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        self.assertIn("requirements-dev.txt", workflow)
        self.assertIn("scripts/validate_schema.py", workflow)
        self.assertTrue((ROOT / "requirements-dev.txt").exists())

    def test_license_uses_current_brand(self) -> None:
        license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")
        self.assertIn("Tagalog Academy contributors", license_text)
        self.assertNotIn("Tagalog Learning Toolkit contributors", license_text)

    def test_standard_number_spellings(self) -> None:
        expected = {
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
        actual = {item["id"]: item["tagalog"] for item in self.lessons["week4"]["vocabulary"]}
        for item_id, spelling in expected.items():
            self.assertEqual(spelling, actual[item_id])

    def test_spelling_and_borrowed_word_variants_are_accepted(self) -> None:
        week1 = {item["id"]: item for item in self.lessons["week1"]["vocabulary"]}
        self.assertEqual("Na-stress ako.", week1["stressed"]["tagalog"])
        self.assertIn("nai-stress ako", week1["stressed"]["accepted"])
        week3 = {item["id"]: item for item in self.lessons["week3"]["vocabulary"]}
        self.assertIn("kuwarto", week3["bedroom"]["accepted"])

    def test_panel_scroll_offset_is_measured_not_hardcoded(self) -> None:
        app = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
        self.assertIn("getBoundingClientRect().height", app)
        self.assertNotIn("offsetTop - 92", app)

    def test_vv_report_does_not_claim_unshipped_source_count(self) -> None:
        report = (ROOT / "UX-VV-REPORT.md").read_text(encoding="utf-8")
        self.assertNotIn("Workbook links mapped | 37", report)


if __name__ == "__main__":
    unittest.main()
