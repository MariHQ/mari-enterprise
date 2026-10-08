#!/usr/bin/env python3
"""Query the live read-only Knowledge API; never connect to a knowledge mirror."""
import argparse
import json
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[3]


def query(query,language='sql'):
    cfg=json.loads((ROOT/'.platform-state/deployment.json').read_text())
    cmd=['kubectl','--context',cfg['context'],'--kubeconfig',str(ROOT/cfg['kubeconfig']),'-n','mari-platform','exec','-i','deployment/knowledge-api','--','python','-c',
         "import os,json,sys,httpx; body=json.load(sys.stdin); r=httpx.post('http://localhost:8000/api/query',json=body,headers={'Authorization':'Bearer '+os.environ['MARI_SERVICE_TOKEN']},timeout=30); r.raise_for_status(); print(json.dumps(r.json(),indent=2))"]
    subprocess.run(cmd,input=json.dumps({'query':query,'language':language}),text=True,check=True)


def main():
    p=argparse.ArgumentParser();p.add_argument('--file',type=Path,default=ROOT/'mari/platform/sql/knowledge.sql')
    p.add_argument('--language',choices=['sql','cypher','gremlin','sparql'],default='sql');p.add_argument('--interactive',action='store_true');a=p.parse_args()
    if a.interactive:
        while True:
            try:line=input(a.language+'> ')
            except (EOFError,KeyboardInterrupt):break
            if line.strip():query(line,a.language)
    else:query(a.file.read_text(),a.language)
if __name__=='__main__':main()
