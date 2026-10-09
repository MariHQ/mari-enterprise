#!/usr/bin/env python3
"""Verify Knative routing, scale-to-zero and cold-start activation; remove test service."""
import json
from pathlib import Path
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
K = ['kubectl', '--context', 'docker-desktop', '-n', 'stack']

def run(*args):
    return subprocess.check_output([*K, *args], text=True)

forward = None
try:
    print(run('apply', '-f', str(ROOT / 'examples/knative-smoke.yaml')), flush=True)
    print(run('wait', 'ksvc/knative-smoke', '--for=condition=Ready', '--timeout=180s'), flush=True)
    forward = subprocess.Popen(['kubectl', '--context', 'docker-desktop', '-n', 'kourier-system',
                                'port-forward', 'svc/kourier', '18084:80', '--address=127.0.0.1'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    def request():
        req = urllib.request.Request('http://127.0.0.1:18084/',
                                     headers={'Host': 'knative-smoke.stack.127.0.0.1.sslip.io'})
        with urllib.request.urlopen(req, timeout=60) as response:
            assert response.status == 200 and b'Welcome to nginx!' in response.read()
    for attempt in range(20):
        try:
            request()
            break
        except OSError:
            if forward.poll() is not None or attempt == 19:
                raise
            time.sleep(1)
    print('PASS: gateway HTTP routing', flush=True)
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        pods = json.loads(run('get', 'pods', '-l', 'serving.knative.dev/service=knative-smoke', '-o', 'json'))
        if not pods['items']:
            break
        time.sleep(3)
    else:
        raise RuntimeError('Service did not scale to zero within 180 seconds')
    print('PASS: idle service scaled to zero pods', flush=True)
    request()
    print('PASS: HTTP request activated service from zero', flush=True)
finally:
    if forward:
        forward.terminate()
        forward.wait(timeout=10)
    print(run('delete', 'ksvc/knative-smoke', '--ignore-not-found'), flush=True)
