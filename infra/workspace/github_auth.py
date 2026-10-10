"""Transient GitHub authentication for workspace coding and archive commands."""
import atexit
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def load_token():
    if os.getenv('MARI_APPS_GITHUB_TOKEN'):
        return os.environ['MARI_APPS_GITHUB_TOKEN']
    secret = json.loads(subprocess.check_output([
        'kubectl', '--context', os.getenv('SUBSTRATE_CONTEXT', 'kind-agent-substrate'),
        '-n', 'ax-system', 'get', 'secret', 'mari-apps-github', '-o', 'json']))
    return base64.b64decode(secret['data']['token']).decode().strip()


def github_environment(token):
    """Keep the credential in process memory; the helper file contains no secret."""
    helper = tempfile.NamedTemporaryFile(mode='w', prefix='mari-github-', suffix='.py', delete=False)
    helper.write('''import os,sys
if len(sys.argv)<2 or sys.argv[1]!='get': sys.exit(0)
fields=dict(line.rstrip('\\n').split('=',1) for line in sys.stdin if '=' in line)
path=fields.get('path','').lower()
if fields.get('protocol')=='https' and fields.get('host')=='github.com' and path.startswith('marihq/mari-app-'):
 print('username=x-access-token')
 print('password='+os.environ['MARI_APPS_GITHUB_TOKEN'])
''')
    helper.close()
    atexit.register(lambda: Path(helper.name).unlink(missing_ok=True))
    env = dict(os.environ, MARI_APPS_GITHUB_TOKEN=token, GIT_TERMINAL_PROMPT='0',
               GIT_CONFIG_GLOBAL='/dev/null')
    # Clear inherited helpers so tokens cannot be persisted by a credential store.
    options = [('credential.helper', ''),
               ('credential.helper', f'!{sys.executable} {helper.name}'),
               ('credential.useHttpPath', 'true')]
    env['GIT_CONFIG_COUNT'] = str(len(options))
    for i, (key, value) in enumerate(options):
        env[f'GIT_CONFIG_KEY_{i}'] = key
        env[f'GIT_CONFIG_VALUE_{i}'] = value
    return env
