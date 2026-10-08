#!/usr/bin/env python3
"""Forward local consoles until interrupted."""
import json
from pathlib import Path
import subprocess
import time
ROOT=Path(__file__).resolve().parents[3]
def main():
    cfg=json.loads((ROOT/'.platform-state/deployment.json').read_text())
    base=['kubectl','--context',cfg['context']]
    if cfg.get('kubeconfig'):base+=['--kubeconfig',str(ROOT/cfg['kubeconfig'])]
    procs=[]
    commands=[]
    try:
        for service,ports in [('mari-governance','8081:8000'),('api','8082:8000'),('temporal-ui','8233:8080')]:
            commands.append(base+['-n','mari-platform','port-forward','service/'+service,ports])
            procs.append(subprocess.Popen(commands[-1]))
        print('Mari: http://localhost:8081/ | Ingestion API: http://localhost:8082 | Temporal: http://localhost:8233',flush=True)
        while True:
            time.sleep(2)
            for i,p in enumerate(procs):
                if p.poll() is not None:procs[i]=subprocess.Popen(commands[i])
    except KeyboardInterrupt:pass
    finally:
        for p in procs:p.terminate()
        for p in procs:p.wait()
if __name__=='__main__':main()
