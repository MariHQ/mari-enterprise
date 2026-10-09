"""Bounded ontology extraction inside the existing AX/Substrate guest."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from mari_kit.ontology import VERSION, SCHEMA, windows, prompt, candidates


def mine(request, generate):
    records=request['evidence'];claims={};entities={};calls=0;rejected=0
    for window in windows(records):
        result=generate(prompt(window),VERSION)
        # One unsupported assertion must not discard other grounded assertions.
        for claim in result['claims']:
            try:found,nodes=candidates({'entities':result['entities'],'claims':[claim]},window,request['context_id'])
            except ValueError:
                rejected+=1
                continue
            for row in found:claims[row['candidate_id']]=row
            for node in nodes:entities[node['record_id']]=node
        calls+=1
    return {'candidates':list(claims.values()),'entities':list(entities.values()),'calls':calls,
        'error':f'Rejected {rejected} candidates with invalid endpoints or unsupported quotations.' if rejected else None}


def main():
    request=json.load(sys.stdin)
    token=request.pop('claude_oauth_token',None)
    if not token:raise RuntimeError('Claude subscription token is not configured')
    env={k:v for k,v in os.environ.items() if not k.startswith(('ANTHROPIC_','CLAUDE_CODE_USE_'))}
    env['CLAUDE_CODE_OAUTH_TOKEN']=token
    env['CLAUDE_CODE_MAX_OUTPUT_TOKENS']='12000'
    model=request.get('model','sonnet');budget=float(request.get('budget_usd',2))
    root=Path('/workspace/mari-trajectories');root.mkdir(parents=True,exist_ok=True)
    # Completed calls survive Temporal retries without paying for them again.
    cache=root/(hashlib.sha256(json.dumps([VERSION,model,request['context_id'],[(r['source_id'],r['event_id']) for r in request['evidence']]],sort_keys=True).encode()).hexdigest()+'.json')
    cached=json.loads(cache.read_text()) if cache.exists() else {}
    stats={'input_tokens':0,'output_tokens':0,'cache_read_tokens':0,'cache_creation_tokens':0,'cost_usd':0.0}
    started=time.monotonic();hits=0
    def generate(text,version):
        nonlocal hits
        key=hashlib.sha256(text.encode()).hexdigest()
        if key in cached:
            if cached[key]['result'] is not None:
                hits+=1
                return cached[key]['result']
            if cached[key].get('run_id')==request['run_id']:
                raise RuntimeError('Model call did not complete; deferred to the next scheduled run')
        spent=sum(v['stats']['cost_usd'] for v in cached.values() if v.get('run_id')==request['run_id'])
        remaining=budget-spent
        if remaining<0.05:raise RuntimeError('Extraction budget reached; context remains unacknowledged')
        result=subprocess.run(['claude','-p','--model',model,'--effort','medium','--tools','',
            '--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','',
            '--no-session-persistence','--max-budget-usd',str(remaining),'--output-format','json','--json-schema',json.dumps(SCHEMA)],
            input=text,text=True,capture_output=True,env=env,timeout=240)
        if result.returncode:raise RuntimeError('Claude extraction failed; check guest logs')
        output=json.loads(result.stdout)
        usage=output.get('usage',{})
        counters={'input_tokens':int(usage.get('input_tokens',0)),'output_tokens':int(usage.get('output_tokens',0)),
            'cache_read_tokens':int(usage.get('cache_read_input_tokens',0)),'cache_creation_tokens':int(usage.get('cache_creation_input_tokens',0)),
            'cost_usd':float(output.get('total_cost_usd',0))}
        cached[key]={'result':output.get('structured_output') if not output.get('is_error') else None,'stats':counters,'run_id':request['run_id']}
        temp=cache.with_suffix('.tmp');temp.write_text(json.dumps(cached));temp.replace(cache)
        if not isinstance(cached[key]['result'],dict):raise RuntimeError('Claude returned no complete ontology; source remains unacknowledged')
        return output['structured_output']
    try:
        result=mine(request,generate)
        result['status']='completed'
    except Exception as error:
        result={'candidates':[],'entities':[],'status':'deferred','error':str(error)}
    # Count this run's calls (including recovered activity retries), not prior runs.
    for value in cached.values():
        if value.get('run_id')!=request['run_id']:continue
        for key in stats:stats[key]+=value['stats'][key]
    result['stats']={**stats,'model':model,'duration_ms':int((time.monotonic()-started)*1000),'cache_hits':hits}
    # A timeout/CLI error may have spent tokens without returning usage. Reserve
    # its whole allowance rather than treating an unknown charge as free.
    result['budget_used_usd']=stats['cost_usd'] if result['status']=='completed' else max(budget,stats['cost_usd'])
    print(json.dumps(result))

if __name__=='__main__':main()
