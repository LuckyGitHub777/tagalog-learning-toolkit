import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class StaticTests(unittest.TestCase):
    def test_gitattributes_enforces_lf_and_binary_assets(self):
        attributes = (ROOT / '.gitattributes').read_text(encoding='utf-8')
        self.assertIn('* text=auto eol=lf', attributes)
        for pattern in ['*.pdf binary', '*.png binary', '*.ico binary']:
            self.assertIn(pattern, attributes)

    def test_lesson_cards_are_buttons(self):
        self.assertIn('<button type="button" class="lesson-card', (ROOT / 'assets/js/app.js').read_text(encoding='utf-8'))

    def test_search_list_is_not_live_region(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertIn('id="lesson-groups" class="lesson-groups"', html)
        self.assertNotIn('id="lesson-groups" class="lesson-groups" aria-live', html)

    def test_import_commits_after_validation(self):
        app = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')
        segment = app[app.index('async function importProgress'):app.index('function resetAllProgress')]
        self.assertLess(segment.index('candidate.set'), segment.index('safeStorage.setItem(progressKey(id)'))

    def test_load_failure_reverts_selection(self):
        app = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')
        self.assertIn("$('#lesson-select').value = previousId", app)
        self.assertIn('could not load. Your current lesson is still open', app)

    def test_theme_defaults_to_system(self):
        self.assertIn("|| 'system'", (ROOT / 'assets/js/theme.js').read_text(encoding='utf-8'))

    def test_manifest_validator_ignores_generated_python_cache(self):
        validator = (ROOT / "scripts" / "validate_manifest.py").read_text(encoding="utf-8")
        self.assertIn("__pycache__", validator)
        self.assertIn(".pyc", validator)

    def test_manifest_validator_ignores_git_metadata_and_site_build(self):
        import hashlib
        import shutil
        import subprocess
        import sys
        import tempfile

        with tempfile.TemporaryDirectory() as temp_dir:
            fixture = Path(temp_dir)
            (fixture / 'scripts').mkdir()
            shutil.copy2(
                ROOT / 'scripts' / 'validate_manifest.py',
                fixture / 'scripts' / 'validate_manifest.py',
            )
            payload = fixture / 'payload.txt'
            payload.write_text('release payload\n', encoding='utf-8')
            manifest_rows = []
            for release_file in [fixture / 'payload.txt', fixture / 'scripts' / 'validate_manifest.py']:
                digest = hashlib.sha256(release_file.read_bytes()).hexdigest()
                rel = release_file.relative_to(fixture).as_posix()
                manifest_rows.append(f'{digest}  {rel}')
            (fixture / 'MANIFEST.sha256').write_text(
                '\n'.join(manifest_rows) + '\n',
                encoding='utf-8',
            )
            (fixture / '.git' / 'objects').mkdir(parents=True)
            (fixture / '.git' / 'config').write_text('[core]\n', encoding='utf-8')
            (fixture / '.git' / 'objects' / 'temporary').write_bytes(b'git metadata')
            (fixture / '_site').mkdir()
            (fixture / '_site' / 'index.html').write_text(
                '<!doctype html>\n',
                encoding='utf-8',
            )

            result = subprocess.run(
                [sys.executable, str(fixture / 'scripts' / 'validate_manifest.py')],
                cwd=fixture,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
            self.assertIn('MANIFEST PASS: 2 release files', result.stdout)

    def test_setup_node_is_pinned(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text(encoding='utf-8')
        self.assertRegex(workflow, r'actions/setup-node@[0-9a-f]{40}')
        self.assertIn('node-version: "24"', workflow)

    def test_nonpractice_rows_do_not_render_familiar_controls(self):
        app = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')
        self.assertIn("${item.practice ? `<button type=\"button\" class=\"icon-button", app)

    def test_familiar_toggle_preserves_the_control(self):
        app = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')
        segment = app[app.index("const familiar = event.target.closest('[data-familiar-id]')"):app.index('const generate =', app.index("const familiar = event.target.closest('[data-familiar-id]')"))]
        self.assertNotIn('renderVocabulary()', segment)
        self.assertIn("familiar.setAttribute('aria-pressed'", segment)

    def test_continue_and_next_lesson_are_real_actions(self):
        app = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertIn("$('#continue-learning').addEventListener('click', continueLearning)", app)
        self.assertIn('id="next-lesson"', html)
        self.assertIn("$('#next-lesson').addEventListener", app)

    def test_no_random_sort_shuffle(self):
        js = '\n'.join((ROOT / path).read_text(encoding='utf-8') for path in ['assets/js/core.js', 'assets/js/app.js'])
        self.assertNotRegex(js, r'\.sort\(\(\)\s*=>\s*Math\.random\(\)\s*-\s*\.5\)')

    def test_lesson_cards_have_done_state(self):
        app = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')
        self.assertIn("complete ? 'is-complete'", app)
        self.assertIn("Done ✓", app)
        self.assertIn("marked done", app)

    def test_404_matches_public_security_and_theme_baseline(self):
        html = (ROOT / '404.html').read_text(encoding='utf-8')
        for token in [
            'Content-Security-Policy',
            'strict-origin-when-cross-origin',
            '/assets/js/theme.js',
            'theme-color',
            'apple-touch-icon',
            'favicon.svg',
        ]:
            self.assertIn(token, html)

    def test_public_repository_templates_are_present(self):
        required = [
            '.github/CODEOWNERS',
            '.github/PULL_REQUEST_TEMPLATE.md',
            '.github/ISSUE_TEMPLATE/bug-report.yml',
            '.github/ISSUE_TEMPLATE/language-correction.yml',
            '.github/ISSUE_TEMPLATE/content-rights.yml',
            '.github/ISSUE_TEMPLATE/config.yml',
        ]
        for rel in required:
            self.assertTrue((ROOT / rel).is_file(), rel)

    def test_service_worker_lifecycle_is_documented(self):
        architecture = (ROOT / 'PRODUCT-ARCHITECTURE.md').read_text(encoding='utf-8').lower()
        self.assertIn('all open tagalog academy tabs', architecture)
        self.assertIn('stale-while-revalidate', architecture)

    def test_pages_deployment_is_gated_by_validation(self):
        workflow = (ROOT / '.github/workflows/pages.yml').read_text(encoding='utf-8')
        self.assertIn('needs: validate', workflow)
        self.assertIn('pages: write', workflow)
        self.assertIn('id-token: write', workflow)
        self.assertIn('python scripts/validate_repo.py', workflow)
        self.assertIn('python scripts/validate_manifest.py', workflow)
        for action in ['checkout', 'setup-python', 'setup-node', 'configure-pages', 'upload-pages-artifact', 'deploy-pages']:
            self.assertRegex(workflow, rf'actions/{action}@[0-9a-f]{{40}}')

    def test_public_pages_do_not_link_to_markdown(self):
        for name in ['index.html', '404.html', 'privacy.html', 'language-notes.html', 'content-use.html']:
            html = (ROOT / name).read_text(encoding='utf-8')
            self.assertNotRegex(html, r'href="[^"]+\.md(?:[#?][^"]*)?"', name)

    def test_information_pages_match_public_security_baseline(self):
        for name in ['privacy.html', 'language-notes.html', 'content-use.html']:
            html = (ROOT / name).read_text(encoding='utf-8')
            for token in ['Content-Security-Policy', 'strict-origin-when-cross-origin', '/assets/js/theme.js', 'theme-color', 'apple-touch-icon', 'favicon.svg']:
                self.assertIn(token, html, f'{name}: {token}')


    def test_language_guide_states_correction_standard(self):
        html = (ROOT / 'language-notes.html').read_text(encoding='utf-8')
        self.assertIn('consistent beginner standard maintained by Tagalog Academy', html)
        self.assertIn('Evidence-based corrections', html)

    def test_internal_history_files_are_not_shipped(self):
        for name in ['CHANGELOG.md', 'ROADMAP.md', 'CURRICULUM-TRANSFORMATION.md', 'PUBLISHING-CHECKLIST.md', 'RELEASE-NOTES.md', 'VV-REPORT-v4.0.0.md']:
            self.assertFalse((ROOT / name).exists(), name)

    def test_public_site_build_excludes_markdown(self):
        build = (ROOT / 'scripts/build_site.py').read_text(encoding='utf-8')
        self.assertIn("suffix.lower() == '.md'", build)
        self.assertIn("DIRECTORIES = ['assets', 'data', 'downloads', 'docs']", build)

    def test_final_release_version_has_no_rc_suffix(self):
        catalog = (ROOT / 'data/catalog.json').read_text(encoding='utf-8')
        service_worker = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
        self.assertIn('"version": "4.0.0"', catalog)
        self.assertIn("tagalog-academy-v4.0.0", service_worker)
        self.assertNotIn('4.0.0-rc', catalog + service_worker)


if __name__ == '__main__':
    unittest.main()
