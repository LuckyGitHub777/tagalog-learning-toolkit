import json
import re
import unittest
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def norm(value):
    text = ''.join(
        char for char in unicodedata.normalize('NFD', str(value).lower())
        if unicodedata.category(char) != 'Mn'
    )
    text = re.sub(r'[“”‘’\'"!?.,;:()\[\]{}]', '', text)
    text = re.sub(r'[-–—]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def exercise_english(item):
    return item.get('exercise_english') or item['english']


class ContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'data/catalog.json').read_text(encoding='utf-8'))
        cls.lessons = [
            json.loads((ROOT / meta['file']).read_text(encoding='utf-8'))
            for meta in cls.catalog['lessons']
        ]

    def test_nine_ordered_lessons(self):
        self.assertEqual([lesson['order'] for lesson in self.lessons], list(range(1, 10)))

    def test_global_ids_unique(self):
        ids = [item['id'] for lesson in self.lessons for item in lesson['vocabulary']]
        self.assertEqual(len(ids), len(set(ids)))

    def test_displayed_answers_are_accepted(self):
        for lesson in self.lessons:
            for item in lesson['vocabulary']:
                if item['practice']:
                    self.assertIn(norm(item['tagalog']), item['accepted'], item['id'])

    def test_practice_prompts_are_unique_within_each_lesson(self):
        for lesson in self.lessons:
            prompts = [
                norm(exercise_english(item))
                for item in lesson['vocabulary']
                if item['practice']
            ]
            self.assertEqual(
                len(prompts),
                len(set(prompts)),
                f'Ambiguous exercise prompt in {lesson["id"]}',
            )

    def test_no_slash_teaching_forms(self):
        for lesson in self.lessons:
            for item in lesson['vocabulary']:
                self.assertNotIn('/', item['tagalog'], item['id'])

    def test_no_external_learning_dependency(self):
        for lesson in self.lessons:
            for resource in lesson['resources']:
                self.assertFalse(resource['url'].startswith('http'))

    def test_resources_open_the_current_lesson_page(self):
        for lesson in self.lessons:
            expected = f'#page={lesson["order"] + 1}'
            self.assertEqual(len(lesson['resources']), 3, lesson['id'])
            for resource in lesson['resources']:
                self.assertIn(expected, resource['url'], f'{lesson["id"]}: {resource["title"]}')

    def test_no_public_week_labels(self):
        for rel in ['index.html', 'README.md', 'data/catalog.json']:
            text = (ROOT / rel).read_text(encoding='utf-8').lower()
            self.assertNotRegex(text, r'\bweeks?\b')

    def test_routine_aspect_is_explicit(self):
        lesson = next(item for item in self.lessons if item['id'] == 'daily-routine')
        completed = [
            item for item in lesson['vocabulary']
            if item['category'] == 'Completed actions'
        ]
        self.assertTrue(completed)
        self.assertTrue(all('Completed aspect' in item.get('note', '') for item in completed))

    def test_lessons_are_published_and_explanations_are_complete(self):
        for lesson in self.lessons:
            self.assertEqual(lesson.get('content_status'), 'Published')
            for item in lesson['vocabulary']:
                if item.get('practice'):
                    self.assertTrue(item.get('explanation', '').strip(), item['id'])

    def test_explanations_have_well_formed_punctuation(self):
        malformed = re.compile(r'[.!?][”’\"\']\.|\.\.')
        for lesson in self.lessons:
            for item in lesson['vocabulary']:
                if item.get('practice'):
                    explanation = item.get('explanation', '').strip()
                    self.assertIsNone(malformed.search(explanation), item['id'])

    def test_public_language_data_has_no_unfinished_status_copy(self):
        banned = [r'\bpending\b', r'not authoritative', r'not certified', r'review remains open', r'public beta']
        for lesson in self.lessons:
            text = str(lesson).lower()
            for pattern in banned:
                self.assertIsNone(re.search(pattern, text), pattern)


if __name__ == '__main__':
    unittest.main()
