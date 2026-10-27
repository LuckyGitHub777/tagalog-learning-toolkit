"""Regenerate MANIFEST.sha256 from the files published to the public site."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_manifest import MANIFEST, digests, render  # noqa: E402


def main() -> None:
    entries = digests()
    MANIFEST.write_text(render(entries), encoding='utf-8')
    print(f'MANIFEST UPDATED: {len(entries)} public files')


if __name__ == '__main__':
    main()
