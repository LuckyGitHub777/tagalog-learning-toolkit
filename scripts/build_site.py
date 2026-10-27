from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'
FILES = [
    'index.html', '404.html', 'privacy.html', 'language-notes.html', 'content-use.html',
    'manifest.webmanifest', 'robots.txt', 'sitemap.xml', 'CNAME', 'service-worker.js'
]
DIRECTORIES = ['assets', 'data', 'downloads', 'docs']
IGNORED_PARTS = {'__pycache__'}
IGNORED_NAMES = {'.DS_Store', 'Thumbs.db'}
IGNORED_SUFFIXES = {'.pyc', '.pyo'}


def is_published(path: Path, root: Path) -> bool:
    rel = path.relative_to(root)
    return (
        path.is_file()
        and not IGNORED_PARTS.intersection(rel.parts)
        and path.name not in IGNORED_NAMES
        and path.suffix not in IGNORED_SUFFIXES
    )


def public_files(root: Path = ROOT) -> list[str]:
    """Every repository path that is published to the public site."""
    paths = []
    for rel in FILES:
        if not (root / rel).is_file():
            raise SystemExit(f'Missing public file: {rel}')
        paths.append(rel)
    for rel in DIRECTORIES:
        source = root / rel
        if not source.is_dir():
            raise SystemExit(f'Missing public directory: {rel}')
        paths.extend(
            path.relative_to(root).as_posix()
            for path in source.rglob('*')
            if is_published(path, root)
        )
    return sorted(paths)


def build(root: Path = ROOT) -> None:
    out = root / '_site'
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()

    for rel in public_files(root):
        target = out / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / rel, target)

    if any(path.suffix.lower() == '.md' for path in out.rglob('*') if path.is_file()):
        raise SystemExit('Public site artifact must not contain Markdown files')

    print(f'Built public site: {sum(1 for path in out.rglob("*") if path.is_file())} files')


if __name__ == '__main__':
    build()
