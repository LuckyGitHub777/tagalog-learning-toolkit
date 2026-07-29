from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'MANIFEST.sha256'

IGNORED_DIRECTORIES = {
    '.git',
    '_site',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
}
IGNORED_FILES = {'.DS_Store', 'Thumbs.db'}
IGNORED_SUFFIXES = {'.pyc', '.pyo'}


def is_release_file(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if path.name == 'MANIFEST.sha256':
        return False
    if any(part in IGNORED_DIRECTORIES for part in rel.parts):
        return False
    if path.name in IGNORED_FILES:
        return False
    if path.suffix in IGNORED_SUFFIXES:
        return False
    return path.is_file()


def read_manifest() -> dict[str, str]:
    if not MANIFEST.exists():
        raise SystemExit('MANIFEST.sha256 missing')

    listed: dict[str, str] = {}
    for line_number, line in enumerate(
        MANIFEST.read_text(encoding='utf-8').splitlines(),
        start=1,
    ):
        if not line.strip():
            continue
        try:
            digest, rel = line.split('  ', 1)
        except ValueError as exc:
            raise SystemExit(
                f'Invalid manifest line {line_number}: expected "<sha256>  <path>"'
            ) from exc
        if rel in listed:
            raise SystemExit(f'Duplicate manifest path: {rel}')
        listed[rel] = digest
    return listed


def main() -> None:
    listed = read_manifest()
    actual = {
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob('*')
        if is_release_file(path)
    }

    if set(listed) != actual:
        missing = sorted(actual - set(listed))
        extra = sorted(set(listed) - actual)
        raise SystemExit(f'Manifest coverage mismatch. Missing={missing} Extra={extra}')

    for rel, digest in listed.items():
        got = hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
        if got != digest:
            raise SystemExit(f'Hash mismatch: {rel}')

    print(f'MANIFEST PASS: {len(listed)} release files')


if __name__ == '__main__':
    main()
