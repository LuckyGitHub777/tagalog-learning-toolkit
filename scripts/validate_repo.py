from pathlib import Path
from urllib.parse import urlsplit
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
VERSION = '4.0.0'
PUBLIC_PAGES = ['index.html', '404.html', 'privacy.html', 'language-notes.html', 'content-use.html']
REMOVED_HISTORY = {
    'CHANGELOG.md',
    'CONTENT-NOTES.md',
    'CURRICULUM-TRANSFORMATION.md',
    'PUBLISHING-CHECKLIST.md',
    'RELEASE-NOTES.md',
    'ROADMAP.md',
    'VV-REPORT-v4.0.0.md',
}
errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def norm(value: object) -> str:
    text = ''.join(
        char for char in unicodedata.normalize('NFD', str(value).lower())
        if unicodedata.category(char) != 'Mn'
    )
    text = re.sub(r'[“”‘’\'"!?.,;:()\[\]{}]', '', text)
    text = re.sub(r'[-–—]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def exercise_prompt(item: dict) -> str:
    return item.get('exercise_english') or item['english']


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')


required = [
    '.gitattributes', 'index.html', '404.html', 'privacy.html', 'language-notes.html', 'content-use.html',
    'robots.txt', 'sitemap.xml', 'CNAME', '.nojekyll', 'manifest.webmanifest',
    'service-worker.js', 'SECURITY.md', 'README.md', 'LANGUAGE-GUIDE.md',
    'CONTENT-LICENSE.md', 'PRODUCT-ARCHITECTURE.md',
    'data/catalog.json', 'data/lesson.schema.json',
    'scripts/build_site.py', 'scripts/validate_repo.py', 'scripts/validate_schema.py',
    'scripts/validate_manifest.py', 'scripts/validate_github_templates.py',
    'tests/test_core.mjs', 'tests/test_service_worker.mjs',
    '.github/workflows/ci.yml', '.github/workflows/pages.yml', '.github/dependabot.yml',
    '.github/CODEOWNERS', '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/ISSUE_TEMPLATE/bug-report.yml',
    '.github/ISSUE_TEMPLATE/language-correction.yml',
    '.github/ISSUE_TEMPLATE/content-rights.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
]
for rel in required:
    if not (ROOT / rel).exists():
        fail(f'Missing {rel}')

# Cross-platform Git policy: LF for text and explicit binary handling.
attributes_path = ROOT / '.gitattributes'
if attributes_path.exists():
    attributes = attributes_path.read_text(encoding='utf-8')
    if '* text=auto eol=lf' not in attributes:
        fail('.gitattributes must enforce LF for repository text')
    for pattern in ['*.pdf binary', '*.png binary', '*.ico binary']:
        if pattern not in attributes:
            fail(f'.gitattributes missing binary rule: {pattern}')

for rel in REMOVED_HISTORY:
    if (ROOT / rel).exists():
        fail(f'Internal history file must not ship: {rel}')

if (ROOT / 'CNAME').read_text(encoding='utf-8').strip() != 'tagalog.academy':
    fail('CNAME must contain tagalog.academy')

catalog = json.loads(read('data/catalog.json'))
if catalog.get('version') != VERSION:
    fail('Catalog version mismatch')
if len(catalog.get('lessons', [])) != 9:
    fail('Expected 9 lessons')

seen: set[str] = set()
total = 0
for meta in catalog.get('lessons', []):
    path = ROOT / meta['file']
    if not path.exists():
        fail(f'Missing lesson {meta["file"]}')
        continue
    lesson = json.loads(path.read_text(encoding='utf-8'))
    if lesson.get('version') != VERSION:
        fail(f'Lesson version mismatch for {meta["id"]}')
    if lesson.get('id') != meta['id'] or lesson.get('order') != meta['order']:
        fail(f'Catalog mismatch for {meta["id"]}')
    if lesson.get('content_status') != 'Published':
        fail(f'Lesson must use published status: {meta["id"]}')

    prompts: list[str] = []
    for item in lesson.get('vocabulary', []):
        total += 1
        item_id = item['id']
        if item_id in seen:
            fail(f'Duplicate vocabulary id {item_id}')
        seen.add(item_id)
        if '/' in item['tagalog']:
            fail(f'Slash-separated teaching form: {item_id}')
        accepted = item.get('accepted', [])
        if any('/' in form for form in accepted):
            fail(f'Slash accepted form: {item_id}')
        if item.get('practice'):
            if norm(item['tagalog']) not in accepted:
                fail(f'Displayed answer not accepted: {item_id}')
            explanation = item.get('explanation', '').strip()
            if not explanation:
                fail(f'Practice explanation missing: {item_id}')
            if re.search(r'[.!?][”’\"\']\.', explanation) or '..' in explanation:
                fail(f'Malformed explanation punctuation: {item_id}')
            prompts.append(norm(exercise_prompt(item)))

    if len(prompts) != len(set(prompts)):
        fail(f'Ambiguous exercise prompt in {lesson["id"]}')

    expected_page = f'#page={lesson["order"] + 1}'
    resources = lesson.get('resources', [])
    if len(resources) != 3:
        fail(f'Expected three lesson-specific resources in {lesson["id"]}')
    for resource in resources:
        if re.match(r'https?://', resource['url']):
            fail(f'External resource in lesson {lesson["id"]}')
        if expected_page not in resource['url']:
            fail(f'Resource does not deep-link to lesson page in {lesson["id"]}: {resource["title"]}')

if total != 246:
    fail(f'Expected 246 vocabulary records, found {total}')

# Public learner pages: complete design/security baseline and no Markdown destinations.
public_security_tokens = [
    'Content-Security-Policy', 'strict-origin-when-cross-origin',
    'assets/js/theme.js', 'theme-color', 'apple-touch-icon', 'favicon.svg',
]
unfinished_public_copy = [
    'privacy-first', 'public beta', 'educator review pending', 'review remains open',
    'not authoritative', 'not certified', 'not complete', 'coming soon',
    'work in progress', 'under construction', 'choose a learning week',
    'course roadmap', 'jeepney school',
]
for rel in PUBLIC_PAGES:
    html = read(rel)
    for token in public_security_tokens:
        if token not in html:
            fail(f'{rel} missing public security/theme baseline: {token}')
    if re.search(r'href=["\'][^"\']+\.md(?:[#?][^"\']*)?["\']', html, flags=re.I):
        fail(f'Public page links directly to Markdown: {rel}')
    lower = html.lower()
    for phrase in unfinished_public_copy:
        if phrase in lower:
            fail(f'Unfinished or legacy public copy in {rel}: {phrase}')

index = read('index.html')
if 'id="next-lesson"' not in index:
    fail('Next-lesson control missing')
for token in ['rel="canonical"', 'og:title', 'twitter:card', 'apple-touch-icon', 'Content-Security-Policy']:
    if token not in index:
        fail(f'Missing launch metadata: {token}')
if 'PRIVACY.md' in index or 'CONTENT-NOTES.md' in index:
    fail('Learner footer must use polished HTML information pages')
if 'github.com/' in index.lower():
    fail('Learner interface must not navigate away to repository chrome')

# Validate internal links from public pages.
for rel in PUBLIC_PAGES:
    html = read(rel)
    for href in re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.I):
        if href.startswith(('http://', 'https://', 'mailto:', 'tel:', '#')):
            continue
        target = urlsplit(href).path.lstrip('/')
        if not target:
            target = 'index.html'
        if not (ROOT / target).exists():
            fail(f'Broken public link in {rel}: {href}')

css = read('assets/css/styles.css')
if ':focus-visible' not in css or 'var(--brand-2)' not in css.split(':focus-visible', 1)[1].split('}', 1)[0]:
    fail('Focus ring must use high-contrast brand color')
if 'prefers-reduced-motion' not in css:
    fail('Reduced-motion support missing')
if '.lesson-card.is-complete' not in css:
    fail('Completed lesson state missing')
if '.information-shell' not in css or '.information-card' not in css or '.appearance-toggle' not in css:
    fail('Final information-page or compact appearance styling missing')

app = read('assets/js/app.js')
if 'validateRawProgress' not in app or 'Nothing was changed' not in app:
    fail('Safe import validation missing')
if '<button type="button" class="lesson-card' not in app:
    fail('Lesson cards must be native buttons')
if "$('#continue-learning').addEventListener('click', continueLearning)" not in app:
    fail('Continue learning must advance learning state')
if '${item.practice ? `<button type="button" class="icon-button' not in app:
    fail('Familiar control must be limited to persistent practice records')
if '.sort(() => Math.random() - .5)' in app:
    fail('Biased random-sort shuffle remains in app')
if 'mergeItemProgress' not in app or 'v4ItemMigrationComplete' not in app:
    fail('Item-only legacy progress migration missing')
for token in ['Done ✓', 'marked done', 'Mark lesson done']:
    if token not in app:
        fail(f'Final lesson-state wording missing: {token}')
if 'Complete ✓' in app or 'marked complete' in app:
    fail('Conflicting completion wording remains')

core = read('assets/js/core.js')
if '.sort(() => Math.random() - .5)' in core:
    fail('Biased random-sort shuffle remains in core')
for token in ['exerciseEnglish', 'shuffle', 'mergeItemProgress', 'sourceId']:
    if token not in core:
        fail(f'Core learning invariant support missing: {token}')

sw = read('service-worker.js')
if f'tagalog-academy-v{VERSION}' not in sw:
    fail('Service-worker cache version mismatch')
if 'const fresh = await update' not in sw or "new Response('Unavailable', {status: 503})" not in sw:
    fail('Service-worker offline fallback is not guaranteed to return a Response')
if 'clients.claim' in sw or 'skipWaiting' in sw:
    fail('Service worker must not replace the active version mid-session')
for rel in ['privacy.html', 'language-notes.html', 'content-use.html']:
    if repr('/' + rel) not in sw and repr(rel) not in sw:
        fail(f'Service-worker shell missing {rel}')

# Pull-request CI and deploy-gated GitHub Pages workflow.
ci = read('.github/workflows/ci.yml')
pages = read('.github/workflows/pages.yml')
for workflow_name, workflow in [('CI', ci), ('Pages', pages)]:
    for action in ['checkout', 'setup-python', 'setup-node']:
        if not re.search(rf'actions/{action}@[0-9a-f]{{40}}', workflow):
            fail(f'{workflow_name}: {action} action is not SHA-pinned')
    if 'node-version: "24"' not in workflow:
        fail(f'{workflow_name}: Node.js runtime version is not pinned')
    for command in [
        'validate_repo.py', 'validate_schema.py', 'validate_github_templates.py',
        'validate_manifest.py', 'test_core.mjs', 'test_service_worker.mjs',
    ]:
        if command not in workflow:
            fail(f'{workflow_name} missing {command}')

for action in ['configure-pages', 'upload-pages-artifact', 'deploy-pages']:
    if not re.search(rf'actions/{action}@[0-9a-f]{{40}}', pages):
        fail(f'Pages: {action} action is not SHA-pinned')
for token in ['needs: validate', 'pages: write', 'id-token: write', 'python scripts/build_site.py', 'path: _site']:
    if token not in pages:
        fail(f'Pages deployment gate missing: {token}')
if 'push:' not in pages or 'branches: [main]' not in pages:
    fail('Pages workflow must deploy only from main')

# The public artifact is intentionally HTML/assets only.
build_script = read('scripts/build_site.py')
if "suffix.lower() == '.md'" not in build_script:
    fail('Public site builder must reject Markdown files')
for token in ["'privacy.html'", "'language-notes.html'", "'content-use.html'"]:
    if token not in build_script:
        fail(f'Public site builder missing {token}')

# Repository and lesson data must not contain private operational references.
private_patterns = ['zoom.us', 'forms.gle', 'docs.google.com/forms', '@jeepneyschool', '#jeepneyschool']
for path in ROOT.rglob('*'):
    if not path.is_file() or '_site' in path.parts or '__pycache__' in path.parts:
        continue
    if path.suffix.lower() in {'.png', '.pdf', '.ico'} or path.name == 'validate_repo.py':
        continue
    text = path.read_text(encoding='utf-8', errors='ignore').lower()
    for pattern in private_patterns:
        if pattern in text:
            fail(f'Private or legacy source reference {pattern} in {path.relative_to(ROOT)}')

if errors:
    print('VALIDATION FAILED')
    for error in errors:
        print('-', error)
    raise SystemExit(1)
print(f'VALIDATION PASS: {len(catalog["lessons"])} lessons, {total} vocabulary records')
