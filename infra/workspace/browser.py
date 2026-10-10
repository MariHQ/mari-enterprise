"""Start the local Playwright development tool, reusing a healthy instance."""
import json
from pathlib import Path
import socket
import subprocess
import time

ROOT=Path(__file__).resolve().parents[2]


def ensure_browser():
    endpoint=ROOT/'.artifacts/browser-endpoint.json'
    if endpoint.exists():
        try:
            with socket.create_connection(('127.0.0.1',18083),timeout=1): return
        except OSError: endpoint.unlink(missing_ok=True)
    endpoint.parent.mkdir(parents=True,exist_ok=True)
    with (endpoint.parent/'browser.log').open('ab') as log:
        process=subprocess.Popen(['node',str(Path(__file__).with_suffix('.cjs'))],
                                 stdout=log,stderr=log,start_new_session=True)
    for _ in range(100):
        if endpoint.exists():
            json.loads(endpoint.read_text())
            return
        if process.poll() is not None: raise RuntimeError('Browser failed to start; inspect .artifacts/browser.log')
        time.sleep(.1)
    raise TimeoutError('Local browser startup timed out')


if __name__=='__main__': ensure_browser()
