#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import sys
import unicodedata
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def catalog():
    return json.loads((ROOT / 'data/catalog.json').read_text(encoding='utf-8'))


def lessons():
    course = catalog()
    return [
        (meta, json.loads((ROOT / meta['file']).read_text(encoding='utf-8')))
        for meta in course['lessons']
    ]


def normalize_answer(value: str) -> str:
    text = ''.join(
        char for char in unicodedata.normalize('NFD', str(value).lower())
        if unicodedata.category(char) != 'Mn'
    )
    text = re.sub(r'[“”‘’\'"!?.,;:()\[\]{}]', '', text)
    text = re.sub(r'[-–—]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def exercise_prompt(item: dict) -> str:
    return item.get('exercise_english') or item['english']


def validate():
    commands = [
        [sys.executable, 'scripts/validate_repo.py'],
        [sys.executable, 'scripts/validate_schema.py'],
        [sys.executable, 'scripts/validate_github_templates.py'],
        [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v'],
        [sys.executable, 'scripts/validate_manifest.py'],
    ]
    for command in commands:
        result = subprocess.run(command, cwd=ROOT)
        if result.returncode:
            return result.returncode
    print('All Python validation passed.')
    return 0


def serve(port: int):
    class Handler(SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Cache-Control', 'no-cache')
            super().end_headers()

    import os
    os.chdir(ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Serving Tagalog Academy at http://127.0.0.1:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')


def resolve_lesson(selector: str):
    all_lessons = lessons()
    value = str(selector).strip()
    if value.isdigit():
        number = int(value)
        if 1 <= number <= len(all_lessons):
            return all_lessons[number - 1]
    for meta, lesson in all_lessons:
        if value == meta['id']:
            return meta, lesson
    valid_ids = ', '.join(meta['id'] for meta, _ in all_lessons)
    raise SystemExit(f'Choose a lesson from 1 to {len(all_lessons)} or use one of: {valid_ids}.')


def study(lesson_selector: str, count: int):
    meta, lesson = resolve_lesson(lesson_selector)
    items = [item for item in lesson['vocabulary'] if item.get('practice')]
    random.shuffle(items)
    print(f"\nLesson {meta['order']}: {meta['title']}\n")
    score = 0
    total = min(count, len(items))

    try:
        for index, item in enumerate(items[:total], 1):
            answer = normalize_answer(input(f"{index}. {exercise_prompt(item)}: "))
            accepted = {normalize_answer(value) for value in item['accepted']}
            if answer in accepted:
                print('   Correct.')
                score += 1
            else:
                print(f"   Answer: {item['tagalog']}")
    except (EOFError, KeyboardInterrupt):
        print('\nSession ended.')
        return

    print(f'\nScore: {score}/{total}')


def main():
    parser = argparse.ArgumentParser(description='Tagalog Academy companion')
    sub = parser.add_subparsers(dest='command', required=True)

    serve_parser = sub.add_parser('serve')
    serve_parser.add_argument('--port', type=int, default=8000)

    sub.add_parser('validate')

    study_parser = sub.add_parser('study')
    study_parser.add_argument('--lesson', default='1', help='Lesson number or lesson id')
    study_parser.add_argument('--count', type=int, default=10)

    args = parser.parse_args()
    if args.command == 'serve':
        serve(args.port)
    elif args.command == 'validate':
        raise SystemExit(validate())
    else:
        study(args.lesson, args.count)


if __name__ == '__main__':
    main()
