"""Load the gitignored platform .env without executing shell expressions."""
import os
from pathlib import Path
import re
import shlex


def load_local_env():
    path = Path(__file__).resolve().parents[1] / '.env'
    if not path.exists():
        return
    for number, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, raw = line.removeprefix('export ').partition('=')
        key = key.strip()
        if not separator or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
            raise ValueError(f'Invalid .env assignment at line {number}')
        parts = shlex.split(raw, comments=True)
        if len(parts) > 1:
            raise ValueError(f'Quote .env values containing spaces at line {number}')
        os.environ.setdefault(key, parts[0] if parts else '')
