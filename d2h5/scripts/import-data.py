import concurrent.futures
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '0edfaf6d006f2eb82857c066e07ce03614285981'
TABLES = ['skills', 'skilldesc', 'charstats', 'experience', 'weapons', 'armor', 'misc', 'MagicPrefix', 'MagicSuffix', 'gems', 'Runes', 'UniqueItems', 'SetItems', 'Sets', 'Levels', 'monstats', 'MonLvl', 'SuperUniques', 'TreasureClassEx', 'itemratio', 'ItemTypes', 'difficultylevels', 'hireling', 'cubemain', 'Properties', 'ItemStatCost', 'LvlMaze', 'shrines', 'objects', 'belts', 'automagic', 'Missiles', 'gamble']

def fetch(name):
    target = ROOT / 'src' / 'data' / 'raw' / (name + '.json')
    previous = ROOT / 'src' / 'data' / 'provenance.json'
    if target.exists() and previous.exists():
        old = json.loads(previous.read_text()).get(name)
        if old and 'error' not in old:
            return name, {**old, 'storedSha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    url = f'https://raw.githubusercontent.com/blizzhackers/d2data/{COMMIT}/json/{name}.json'
    try:
        raw = subprocess.check_output(['curl', '--http1.1', '-sS', '-L', '--fail', '--max-time', '60', url], timeout=65)
        data = json.loads(raw)
        target = ROOT / 'src' / 'data' / 'raw' / (name + '.json')
        target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print(f'{name}: {len(data)} rows', flush=True)
        return name, {'url': url, 'commit': COMMIT, 'sha256': hashlib.sha256(raw).hexdigest(), 'storedSha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'rows': len(data)}
    except Exception as exc:
        print(f'{name}: FAILED {exc}', flush=True)
        return name, {'url': url, 'error': str(exc)}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        records = dict(pool.map(fetch, TABLES))
    (ROOT / 'src' / 'data' / 'provenance.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    if any('error' in row for row in records.values()):
        raise SystemExit(1)
