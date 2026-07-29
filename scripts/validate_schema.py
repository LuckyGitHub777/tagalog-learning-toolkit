from pathlib import Path
import json
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parents[1]
schema=json.loads((ROOT/'data/lesson.schema.json').read_text(encoding='utf-8'))
validator=Draft202012Validator(schema)
errors=[]
for path in sorted((ROOT/'data/lessons').glob('*.json')):
    data=json.loads(path.read_text(encoding='utf-8'))
    for error in validator.iter_errors(data):
        errors.append(f"{path.name}: {'/'.join(map(str,error.path))}: {error.message}")
if errors:
    print('SCHEMA VALIDATION FAILED')
    print('\n'.join(f'- {e}' for e in errors))
    raise SystemExit(1)
print(f"SCHEMA PASS: {len(list((ROOT/'data/lessons').glob('*.json')))} lessons")
