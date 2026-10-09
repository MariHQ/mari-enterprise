"""Bounded graph record projection utility for app-owned route handlers."""
from apps.sdk.data import reader
from apps.sdk.graph import projection, DOCUMENTS

def read(kinds,metrics=False):
    rows=reader.execute('MATCH (r:Record) WHERE r.kind IN $kinds RETURN '+projection()+' ORDER BY r.observed_at DESC,r.record_id LIMIT 101',{'kinds':kinds},limit=101)['rows']
    records=[reader.hydrate(r) for r in rows[:100]]
    def scrub(value):
        if isinstance(value,dict): return {k:scrub(v) for k,v in value.items() if not any(word in k.lower() for word in ('secret','password','token','credential','private_key'))}
        if isinstance(value,list): return [scrub(v) for v in value]
        return value
    for record in records:record['properties']=scrub(record['properties'])
    result={'records':records,'truncated':len(rows)>100}
    if metrics:result['metrics']=reader.execute("MATCH (r:Record) WHERE "+DOCUMENTS+" AND NOT r.kind IN ['edge','fact','decision'] RETURN count(r) AS documents")['rows'][0]
    return result
