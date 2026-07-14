#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FILES = [
    'index.html', 'assets/css/styles.css', 'assets/js/app.js',
    'data/lessons/week1.json', 'manifest.webmanifest', 'service-worker.js',
    'tagalog.py', 'README.md', 'UX-VV-REPORT.md', 'CONTENT-NOTES.md',
    'downloads/Tagalog-Week-1-Study-Guide.pdf',
    'downloads/Tagalog-Week-1-Practice.pdf',
    'downloads/Tagalog-Week-1-Answer-Key.pdf',
]


def fail(message: str) -> None:
    print(f'ERROR: {message}', file=sys.stderr)
    raise SystemExit(1)


def check_required_files() -> None:
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).is_file()]
    if missing:
        fail(f'Missing required files: {", ".join(missing)}')


def check_json() -> dict:
    path = ROOT / 'data/lessons/week1.json'
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        json.loads((ROOT / 'data/lesson.schema.json').read_text(encoding='utf-8'))
        json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8'))
    except json.JSONDecodeError as exc:
        fail(f'Invalid JSON: {exc}')
    required = {'version','id','title','vocabulary','adjectives','quiz'}
    if not required <= data.keys():
        fail(f'Lesson is missing keys: {sorted(required - data.keys())}')
    ids = [item['id'] for item in data['vocabulary']]
    if len(ids) != len(set(ids)):
        fail('Vocabulary IDs are not unique')
    for index, item in enumerate(data['quiz']):
        if not 0 <= item['answer'] < len(item['choices']):
            fail(f'Quiz answer out of range at index {index}')
    return data


def check_html() -> int:
    text = (ROOT / 'index.html').read_text(encoding='utf-8')
    ids = re.findall(r'\bid=["\']([^"\']+)["\']', text)
    duplicates = sorted({item for item in ids if ids.count(item) > 1})
    if duplicates:
        fail(f'Duplicate HTML IDs: {", ".join(duplicates)}')
    if re.search('|'.join(['Jeep'+'ney','Pepper'+'dine','cyber'+'security','Los '+'Angeles','Bryan','Lu'+'cky']), text, re.I):
        fail('Personal or legacy brand references remain in index.html')
    refs = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', text)
    local_refs = []
    for ref in refs:
        parsed = urlparse(ref)
        if parsed.scheme or ref.startswith(('#','mailto:','tel:')):
            continue
        clean = parsed.path
        if clean and clean not in {'README.md','UX-VV-REPORT.md','CONTENT-NOTES.md'}:
            local_refs.append(clean)
        elif clean:
            local_refs.append(clean)
    missing = sorted({ref for ref in local_refs if not (ROOT / ref).exists()})
    if missing:
        fail(f'Broken local references: {", ".join(missing)}')
    return len(local_refs)


def check_brand_scrub() -> None:
    blocked = re.compile('|'.join(['Jeep' + 'ney School', 'Pepper' + 'dine University', 'cyber' + 'security', 'Los ' + 'Angeles', 'Bryan ' + 'Lachica', 'Lu' + 'cky']), re.I)
    candidates = [
        path for path in ROOT.rglob('*')
        if path.is_file() and path.suffix.lower() in {'.html','.md','.js','.css','.json','.txt','.py','.yml','.yaml'}
    ]
    hits = []
    for path in candidates:
        text = path.read_text(encoding='utf-8', errors='ignore')
        if blocked.search(text):
            hits.append(str(path.relative_to(ROOT)))
    if hits:
        fail(f'Legacy brand or personal references found in: {", ".join(hits)}')


def check_no_external_runtime() -> None:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'assets/css/styles.css').read_text(encoding='utf-8')
    if re.search(r'<(?:script|link)[^>]+https?://', html, re.I) or re.search(r'url\(\s*["\']?https?://', css, re.I):
        fail('External runtime dependency found')


def check_service_worker() -> None:
    text = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
    refs = re.findall(r"'\./([^']+)'", text)
    missing = sorted({ref for ref in refs if ref and not (ROOT / ref).exists()})
    if missing:
        fail(f'Service worker caches missing files: {", ".join(missing)}')


def write_manifest() -> int:
    excluded = {'MANIFEST.sha256'}
    files = sorted(
        path for path in ROOT.rglob('*')
        if path.is_file() and path.name not in excluded and '__pycache__' not in path.parts and '.pytest_cache' not in path.parts
    )
    lines = []
    for path in files:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f'{digest}  {path.relative_to(ROOT).as_posix()}')
    (ROOT / 'MANIFEST.sha256').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return len(files)


def main() -> int:
    check_required_files()
    data = check_json()
    refs = check_html()
    check_brand_scrub()
    check_no_external_runtime()
    check_service_worker()
    files = write_manifest()
    print(f"PASS: {len(data['vocabulary'])} vocabulary items, {len(data['quiz'])} quiz items, {refs} local references, and {files} files validated.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
