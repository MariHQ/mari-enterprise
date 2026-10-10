#!/usr/bin/env python3
"""Export actor-owned Claude sessions to a local, stock transcript viewer."""
import argparse
import hashlib
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
VIEWER = ROOT / '.artifacts/trace-viewer-venv/bin/claude-code-transcripts'
OUT = ROOT / '.artifacts/workspace-traces'
READ = """from pathlib import Path
import json
root=Path('/workspace/agent/claude/projects')
print(json.dumps({str(p.relative_to(root)): p.read_text()
                  for p in root.glob('**/*.jsonl') if p.is_file()}))
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('actors', nargs='*', default=['lineage', 'lineage-preview'])
    args = parser.parse_args()
    if not VIEWER.is_file():
        parser.error('Install claude-code-transcripts==0.6 in .artifacts/trace-viewer-venv first')
    # Preserve workspace originals. Viewer copies redact exact credential values
    # only; hashes identify the original files for independent inspection.
    from bootstrap import secret
    from github_auth import load_token
    credentials={load_token()}
    for secret_name in ('mari-runtime','mari-worker','orchid-catalog'):
        credentials.update(value for key,value in secret(secret_name).items()
                           if re.search(r'token|secret|password|credential|dsn|key',key,re.I) and len(value)>12)
    credentials.update(value.replace('postgres.stack.svc:5432','host.docker.internal:30432')
                       for value in list(credentials))
    for actor in args.actors:
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,47}', actor):
            parser.error('Actors must be DNS labels in the mari atespace')
        result = subprocess.run([sys.executable, str(ROOT/'infra/workspace/client.py'),
                                 'exec', actor, '--', 'python', '-c', READ],
                                check=True, capture_output=True)
        sessions = json.loads(result.stdout)
        source = OUT / 'source' / actor
        source.mkdir(parents=True, exist_ok=True)
        provenance=[]
        for name, contents in sessions.items():
            digest=hashlib.sha256(contents.encode()).hexdigest()
            redactions=0
            for value in sorted(credentials,key=len,reverse=True):
                redactions+=contents.count(value)
                contents=contents.replace(value,'[REDACTED CREDENTIAL]')
            provenance.append({'source':'/workspace/agent/claude/projects/'+name,'original_sha256':digest,'credential_redactions':redactions})
            target = (source / name).resolve()
            if not target.is_relative_to(source.resolve()):
                raise ValueError('Invalid session path')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(contents)
        output = OUT / 'html' / actor
        output.mkdir(parents=True, exist_ok=True)
        (output/'provenance.json').write_text(json.dumps({'actor':'mari/'+actor,'exported_at':datetime.now(timezone.utc).isoformat(),'note':'Original workspace transcripts are unchanged. Viewer copies redact exact known credentials only.', 'sessions':provenance},indent=2))
        if sessions:
            subprocess.run([str(VIEWER), 'all', '--source', str(source),
                            '--output', str(output), '--include-agents'], check=True)
        else:
            (output/'README.txt').write_text(
                f'mari/{actor}: no saved Claude coding conversations in this workspace.\n'
                'The initial owner was seeded directly; coding ran in lineage-preview.\n')
        print(f'mari/{actor}: {len(sessions)} session files exported to {output}')
    print('Serve locally: python3 -m http.server 18082 --bind 127.0.0.1 --directory '+str(OUT/'html'))


if __name__ == '__main__':
    main()
