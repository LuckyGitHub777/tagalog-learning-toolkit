"""Verify MANIFEST.sha256 against the files published to the public site.

The manifest covers the deployed artifact only. Repository tooling such as
workflows and validation dependencies is excluded so automated dependency
updates do not require a manifest change.
"""
from pathlib import Path
import hashlib
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_site import ROOT, public_files  # noqa: E402

MANIFEST = ROOT / 'MANIFEST.sha256'


def digests(root: Path = ROOT) -> dict[str, str]:
    return {
        rel: hashlib.sha256((root / rel).read_bytes()).hexdigest()
        for rel in public_files(root)
    }


def render(entries: dict[str, str]) -> str:
    return ''.join(f'{digest}  {rel}\n' for rel, digest in sorted(entries.items()))


def read_manifest() -> dict[str, str]:
    if not MANIFEST.exists():
        raise SystemExit('MANIFEST.sha256 missing. Run: python tagalog.py manifest')

    listed: dict[str, str] = {}
    for line_number, line in enumerate(MANIFEST.read_text(encoding='utf-8').splitlines(), start=1):
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
    actual = digests()

    if set(listed) != set(actual):
        missing = sorted(set(actual) - set(listed))
        extra = sorted(set(listed) - set(actual))
        raise SystemExit(
            f'Manifest coverage mismatch. Missing={missing} Extra={extra}. '
            'Run: python tagalog.py manifest'
        )

    for rel, digest in listed.items():
        if actual[rel] != digest:
            raise SystemExit(f'Hash mismatch: {rel}. Run: python tagalog.py manifest')

    print(f'MANIFEST PASS: {len(listed)} public files')


if __name__ == '__main__':
    main()
