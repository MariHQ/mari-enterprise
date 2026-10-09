"""Bounded graph record projection utility for app-owned route handlers."""
from apps.sdk.data import reader

def read(kinds,metrics=False):
    rows=reader.execute('SELECT * FROM graph_records WHERE list_contains($kinds,kind) ORDER BY observed_at DESC,record_id LIMIT 101',{'kinds':kinds},limit=101)['rows']
    records=[reader.hydrate(r) for r in rows[:100]]
    def scrub(value):
        if isinstance(value,dict): return {k:scrub(v) for k,v in value.items() if not any(word in k.lower() for word in ('secret','password','token','credential','private_key'))}
        if isinstance(value,list): return [scrub(v) for v in value]
        return value
    for record in records:record['properties']=scrub(record['properties'])
    result={'records':records,'truncated':len(rows)>100}
    if metrics:result['metrics']=reader.execute("SELECT count(*) AS documents FROM records WHERE kind NOT IN ('edge','fact','decision')")['rows'][0]
    return result
