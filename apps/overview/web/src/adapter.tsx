import {useAuth} from '@mari-app/auth';
import {type RecordData} from '@mari-app/records';
import {QueryCard} from '@mari-app/cards';
import {EMPTY} from './overview';
import {OverviewStatTiles,type OverviewStats} from '@mari-design/components/features/OverviewStatTiles';
import {OverviewRecentDocs} from '@mari-design/components/features/OverviewRecentDocs';
import {OverviewSourcePulse,type PulseTileData} from '@mari-design/components/features/OverviewSourcePulse';
import {OverviewLiveActivity,type FeedItem} from '@mari-design/components/features/OverviewLiveActivity';
import {DigestCard,type DigestTopic} from '@mari-design/components/data-display/DigestCard';
import type {OverviewData} from '@mari-design/components/pages/OverviewPage';
import type {PageData} from '@mari-app/types';
const cards={
 stats:<QueryCard<OverviewStats> path="/api/overview/stats">{r=><OverviewStatTiles stats={r.data} loading={r.loading} offline={!!r.error}/>}</QueryCard>,
 docs:<QueryCard<{recent:RecordData[]}> path="/api/overview">{r=><OverviewRecentDocs docs={(r.data?.recent??[]).map(v=>({id:v.record_id,title:v.title,source:v.source,date:new Date(v.observed_at*1000).toISOString()}))} loading={r.loading} offline={!!r.error}/>}</QueryCard>,
 sources:<QueryCard<PulseTileData[]> path="/api/overview/sources">{r=><OverviewSourcePulse tiles={r.data??[]} loading={r.loading} offline={!!r.error}/>}</QueryCard>,
 digest:<QueryCard<DigestTopic[]> path="/api/overview/knowledge">{r=><DigestCard title="This week's knowledge" topics={r.data??[]} loading={r.loading} error={!!r.error}/>}</QueryCard>,
 activity:<QueryCard<FeedItem[]> path="/api/overview/activity">{r=><OverviewLiveActivity items={r.data??[]} loading={r.loading} offline={!!r.error} pollMs={0}/>}</QueryCard>,
};
export function usePlatformOverview():PageData<OverviewData>{
 const {user}=useAuth();return {loading:false,error:null,data:{...EMPTY,personName:user?.name??'',cards}};
}
