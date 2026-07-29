import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('tagalog_cli', ROOT / 'tagalog.py')
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class CliTests(unittest.TestCase):
    def test_cli_uses_disambiguated_exercise_prompt(self):
        item = {
            'english': 'Mother',
            'exercise_english': 'Mother (formal)',
        }
        self.assertEqual(MODULE.exercise_prompt(item), 'Mother (formal)')

    def test_cli_normalization_matches_learning_recall(self):
        self.assertEqual(MODULE.normalize_answer('  Kumustá? '), 'kumusta')
        self.assertEqual(MODULE.normalize_answer('Na-stress ako.'), 'na stress ako')

    def test_all_cli_practice_prompts_are_unique(self):
        for meta, lesson in MODULE.lessons():
            prompts = [
                MODULE.normalize_answer(MODULE.exercise_prompt(item))
                for item in lesson['vocabulary']
                if item.get('practice')
            ]
            self.assertEqual(
                len(prompts),
                len(set(prompts)),
                f'Ambiguous CLI prompt in {meta["id"]}',
            )

    def test_cli_accepts_stable_lesson_id(self):
        meta, lesson = MODULE.resolve_lesson('people-family')
        self.assertEqual(meta['id'], 'people-family')
        self.assertEqual(lesson['id'], 'people-family')


if __name__ == '__main__':
    unittest.main()
