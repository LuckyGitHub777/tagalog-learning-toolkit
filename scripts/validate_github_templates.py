from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
ISSUES = ROOT / '.github' / 'ISSUE_TEMPLATE'

required_files = [
    ROOT / '.github' / 'CODEOWNERS',
    ROOT / '.github' / 'PULL_REQUEST_TEMPLATE.md',
    ISSUES / 'bug-report.yml',
    ISSUES / 'language-correction.yml',
    ISSUES / 'content-rights.yml',
    ISSUES / 'config.yml',
]

errors = []
for path in required_files:
    if not path.is_file():
        errors.append(f'Missing {path.relative_to(ROOT)}')

for path in required_files[2:5]:
    if not path.is_file():
        continue
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8'))
    except yaml.YAMLError as exc:
        errors.append(f'Invalid YAML in {path.relative_to(ROOT)}: {exc}')
        continue
    if not isinstance(data, dict):
        errors.append(f'Issue form must be a mapping: {path.relative_to(ROOT)}')
        continue
    for field in ('name', 'description', 'body'):
        if not data.get(field):
            errors.append(f'{path.relative_to(ROOT)} missing {field}')
    if not isinstance(data.get('body'), list) or len(data['body']) < 2:
        errors.append(f'{path.relative_to(ROOT)} must contain structured form fields')

config = ISSUES / 'config.yml'
if config.is_file():
    try:
        config_data = yaml.safe_load(config.read_text(encoding='utf-8'))
    except yaml.YAMLError as exc:
        errors.append(f'Invalid YAML in {config.relative_to(ROOT)}: {exc}')
    else:
        if config_data.get('blank_issues_enabled') is not False:
            errors.append('Blank issues must be disabled')
        links = config_data.get('contact_links') or []
        if not any('/security/advisories/new' in str(link.get('url', '')) for link in links if isinstance(link, dict)):
            errors.append('Issue chooser must provide the private security-reporting route')

codeowners = ROOT / '.github' / 'CODEOWNERS'
if codeowners.is_file() and '@LuckyGitHub777' not in codeowners.read_text(encoding='utf-8'):
    errors.append('CODEOWNERS must name the repository owner')

pr_template = ROOT / '.github' / 'PULL_REQUEST_TEMPLATE.md'
if pr_template.is_file():
    text = pr_template.read_text(encoding='utf-8')
    for phrase in ('## Purpose', '## Evidence', '## Checklist'):
        if phrase not in text:
            errors.append(f'Pull request template missing {phrase}')

if errors:
    print('GITHUB TEMPLATE VALIDATION FAILED')
    for error in errors:
        print('-', error)
    raise SystemExit(1)

print('GITHUB TEMPLATE VALIDATION PASS')
