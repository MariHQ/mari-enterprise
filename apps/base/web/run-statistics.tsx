import {QueryCard} from './cards';
import {Card} from '@mari-design/components/layout/Card';
import {ReadError} from '@mari-design/components/feedback/ReadError';
import {SkeletonLine} from '@mari-design/components/data-display/Skeleton';
const labels:Record<string,string>={runs:'Runs',failed:'Failed',deferred:'Deferred',sources:'Source records processed',candidates:'Candidates extracted',input_tokens:'Input tokens',output_tokens:'Output tokens',cache_read_tokens:'Cached input tokens',cache_creation_tokens:'Cache write tokens',cost_usd:'Reported model cost',duration_ms:'Total run time'};
export function RunStatistics(){return <QueryCard<Record<string,number>> path="/api/run-statistics">{r=><Card title="Run statistics" hint="Last 7 days">{r.error?<ReadError>{r.error}</ReadError>:<dl className="grid grid-cols-2 gap-x-5 gap-y-3">{Object.entries(labels).map(([key,label])=><div key={key}><dt className="text-[12px] text-ink/65">{label}</dt><dd className="font-term text-[14px] text-ink">{r.loading?<SkeletonLine w="w-20"/>:key==='cost_usd'?`$${(r.data?.[key]??0).toFixed(4)}`:key==='duration_ms'?`${((r.data?.[key]??0)/1000).toFixed(1)} s`:(r.data?.[key]??0).toLocaleString()}</dd></div>)}</dl>}</Card>}</QueryCard>}

import {DataTable,type Column} from '@mari-design/components/data-display/DataTable';
import {Chip} from '@mari-design/components/data-display/Chip';
import {Truncate} from '@mari-design/components/data-display/Truncate';
import {fmtDateTime} from '@mari-design/components/tokens/format';
import type {RecordData} from './records';
const columns:Column<RecordData>[]=[
 {key:'title',header:'Run',render:r=><Truncate>{r.title}</Truncate>},
 {key:'started',header:'Started',render:r=>r.properties.started_at?fmtDateTime(r.properties.started_at):'Unavailable'},
 {key:'sources',header:'Sources',align:'right',render:r=>r.properties.source_count??'Pending'},
 {key:'claims',header:'Candidates',align:'right',render:r=>r.properties.candidate_count??'Not applicable'},
 {key:'tokens',header:'Model tokens',align:'right',render:r=>r.properties.input_tokens==null?'Not applicable':(r.properties.input_tokens+r.properties.output_tokens).toLocaleString()},
 {key:'cost',header:'Reported cost',align:'right',render:r=>r.properties.cost_usd==null?'Not applicable':`$${Number(r.properties.cost_usd).toFixed(4)}`},
 {key:'status',header:'Status',render:r=><Chip label={r.properties.status??'Unknown'} tone={r.properties.status==='failed'?'blocked':r.properties.status==='completed'?'ok':'info'} dot/>},
];
export function RecentRuns(){return <QueryCard<{records:RecordData[]}> path="/api/run-statistics/recent">{r=>r.error?<Card title="Recent runs"><ReadError>{r.error}</ReadError></Card>:<DataTable title="Recent runs" rows={r.data?.records??[]} columns={columns} rowKey={r=>r.record_id} loading={r.loading} empty="No runs recorded yet" pageSize={5}/>}</QueryCard>}
export function RunCards(){return <div className="flex flex-col gap-5"><RunStatistics/><RecentRuns/></div>}
