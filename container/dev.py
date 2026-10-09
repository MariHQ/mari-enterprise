"""Local preview only: run the built container and all configured apps with ephemeral secrets."""
import os
import json
import argparse
from pathlib import Path
import secrets
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8088)
    parser.add_argument('--sources-port', type=int, default=8014)
    args = parser.parse_args()
    mari = Path(__file__).resolve().parents[1]
    env = dict(os.environ)
    env.setdefault('MARI_PUBLIC_ORIGIN', f'http://127.0.0.1:{args.port}')
    apps=json.loads((mari/'container/apps.json').read_text())['apps']
    for i,item in enumerate(apps): env[item['url_env']]=f'http://127.0.0.1:{args.sources_port+i}'
    env['MARI_EMBEDDED_RUNTIME']='true' 
    for name in ('MARI_SESSION_SECRET', 'MARI_APP_GRANT_SECRET'):
        if not env.get(name): env[name] = secrets.token_urlsafe(48)
    env['PYTHONPATH'] = str(mari)
    processes = []
    try:
        for module, port, identity in [('apps.'+item['id']+'.server:app',str(args.sources_port+i),item['id']) for i,item in enumerate(apps)]+[('container.server:app',str(args.port),'container')]:
            env['MARI_APP_ID']=identity
            processes.append(subprocess.Popen([sys.executable,'-m','uvicorn',module,'--host','127.0.0.1','--port',port],env=env,cwd=mari))
        print(f'Mari preview: http://127.0.0.1:{args.port} | Local login: demo / demo', flush=True)
        while all(process.poll() is None for process in processes): time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes: process.terminate()
        for process in processes: process.wait()


if __name__ == '__main__': main()
