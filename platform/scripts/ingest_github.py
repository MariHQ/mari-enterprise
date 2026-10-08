#!/usr/bin/env python3
"""Read public GitHub issues/PRs and submit them through the signed ingestion endpoint."""
import argparse
import hashlib
import hmac
import json
from pathlib import Path
import re
import urllib.request


def main():
    p=argparse.ArgumentParser();p.add_argument('repo');p.add_argument('--url',default='http://localhost:8082');p.add_argument('--limit',type=int,default=10)
    a=p.parse_args()
    if not re.fullmatch(r'[\w.-]+/[\w.-]+',a.repo) or not 1<=a.limit<=100:p.error('Use owner/repo and a limit of 1–100')
    root=Path(__file__).resolve().parents[3]
    secret=json.loads((root/'.platform-state/app-secrets.json').read_text())['GITHUB_WEBHOOK_SECRET']
    req=urllib.request.Request(f'https://api.github.com/repos/{a.repo}/issues?state=all&per_page={a.limit}',headers={'Accept':'application/vnd.github+json','User-Agent':'mari-runtime'})
    with urllib.request.urlopen(req,timeout=30) as r:issues=json.load(r)
    for issue in issues:
        body=json.dumps({'action':'edited','repository':{'full_name':a.repo},'issue':issue}).encode()
        delivery=f"poll:{a.repo}:{issue['id']}:{issue['updated_at']}"
        sig='sha256='+hmac.new(secret.encode(),body,hashlib.sha256).hexdigest()
        req=urllib.request.Request(a.url+'/hooks/github',data=body,headers={'Content-Type':'application/json','X-GitHub-Delivery':delivery,'X-Hub-Signature-256':sig})
        with urllib.request.urlopen(req,timeout=30) as r:json.load(r)
    print(f'Ingested {len(issues)} public GitHub issues/PRs from {a.repo}; no source writes.')


if __name__=='__main__':main()
