from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'
FILES = [
    'index.html', '404.html', 'privacy.html', 'language-notes.html', 'content-use.html',
    'manifest.webmanifest', 'robots.txt', 'sitemap.xml', 'CNAME', 'service-worker.js'
]
DIRECTORIES = ['assets', 'data', 'downloads', 'docs']

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

for rel in FILES:
    source = ROOT / rel
    if not source.is_file():
        raise SystemExit(f'Missing public file: {rel}')
    shutil.copy2(source, OUT / rel)

for rel in DIRECTORIES:
    source = ROOT / rel
    if not source.is_dir():
        raise SystemExit(f'Missing public directory: {rel}')
    shutil.copytree(source, OUT / rel)

if any(path.suffix.lower() == '.md' for path in OUT.rglob('*') if path.is_file()):
    raise SystemExit('Public site artifact must not contain Markdown files')

print(f'Built public site: {sum(1 for path in OUT.rglob("*") if path.is_file())} files')
