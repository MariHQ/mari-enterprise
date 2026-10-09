"""Run Mari's existing decision extraction recipe using Claude Code in AX."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

from mari_components.knowledge.decisions import extract_decisions, DECISION_VERSION
from mari_components.types import KnowledgeDocument

SCHEMA={'type':'object','properties':{'decisions':{'type':'array','items':{
    'type':'object','properties':{'statement':{'type':'string'},'evidence':{'type':'array','minItems':1,
    'items':{'type':'object','properties':{'document_id':{'type':'string'},'quote':{'type':'string'}},
    'required':['document_id','quote'],'additionalProperties':False}}},
    'required':['statement','evidence'],'additionalProperties':False}}},'required':['decisions'],'additionalProperties':False}


def mine(evidence, generate):
    """Fully process each revision before its caller can acknowledge it."""
    candidates={}
    for source in evidence:
        body=source['text']
        # A large document is processed completely in bounded overlapping windows.
        for start in range(0,len(body),44000):
            doc=KnowledgeDocument(source['source_id'],source.get('title',''),body[start:start+45000],
                source['event_id'],source_url=source.get('url',''))
            for decision in extract_decisions([doc],generate_json=generate):
                citations=[{'source_id':e.document_id,'evidence_id':e.revision,'quote':e.quote} for e in decision.evidence]
                key=hashlib.sha256(json.dumps([decision.statement,citations],sort_keys=True).encode()).hexdigest()
                candidates[key]={'candidate_id':key,'kind':'decision','text':decision.statement,
                    'title':decision.statement[:500],'evidence':citations,
                    'evidence_id':source['event_id'],'source_id':source['source_id'],'url':source.get('url',''),
                    'supporting_record_ids':[source['source_id']],'miner_version':DECISION_VERSION}
    return list(candidates.values())


def main():
    request=json.load(sys.stdin)
    token=request.pop('claude_oauth_token',None)
    if not token:raise RuntimeError('Claude subscription token is not configured')
    env={k:v for k,v in os.environ.items() if not k.startswith(('ANTHROPIC_','CLAUDE_CODE_USE_'))}
    env['CLAUDE_CODE_OAUTH_TOKEN']=token
    model=request.get('model','sonnet')
    trace=[]
    def generate(prompt,version):
        started=datetime.now(timezone.utc).isoformat()
        result=subprocess.run(['claude','-p','--model',model,'--tools','',
            '--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','',
            '--no-session-persistence','--output-format','json','--json-schema',json.dumps(SCHEMA)],
            input=prompt,text=True,capture_output=True,env=env,timeout=180)
        if result.returncode:raise RuntimeError('Claude Code extraction failed; check subscription authentication or limits')
        output=json.loads(result.stdout)
        if output.get('is_error'):raise RuntimeError('Claude Code did not complete extraction')
        value=output.get('structured_output')
        if not isinstance(value,dict):raise ValueError('Claude Code returned no structured decisions')
        trace.append({'name':'extract_decisions','args':{'recipe':version,'model':model},
            'summary':'Extracted '+str(len(value.get('decisions',[])))+' decision candidates',
            'ok':True,'started_at':started,'usage':output.get('usage',{})})
        return value
    run_key=hashlib.sha256(request['run_id'].encode()).hexdigest()
    root=Path('/workspace/mari-trajectories');root.mkdir(parents=True,exist_ok=True)
    result_path=root/(run_key+'.result.json')
    if result_path.exists():
        print(result_path.read_text());return
    candidates=mine(request['evidence'],generate)
    result={'candidates':candidates}
    temporary=result_path.with_suffix('.tmp');temporary.write_text(json.dumps(result));temporary.replace(result_path)
    observation={'prompt':'Extract decisions from new or changed source revisions','model':model,'trace':trace}
    (root/(run_key+'.jsonl')).write_text(json.dumps(observation)+'\n')
    print(json.dumps(result))

if __name__=='__main__':main()
