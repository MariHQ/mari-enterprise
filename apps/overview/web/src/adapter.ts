import {useAuth} from '@mari-app/auth';
import {useRead,type RecordData} from '@mari-app/records';
import {EMPTY as emptyOverview} from './overview';
import type {OverviewData} from '@mari-design/components/pages/OverviewPage';
import type {PageData} from '@mari-app/types';
type Overview={recent:RecordData[]};
export function usePlatformOverview(): PageData<OverviewData> {
  const result=useRead<Overview>('/api/overview');
  const {user}=useAuth();
  return {loading:result.loading,error:result.error,data:{...emptyOverview,personName:user?.name ?? '',
    lake:result.data ? {
      recent:result.data.recent.map(r=>({id:r.record_id,title:r.title,source:r.source,date:new Date(r.observed_at*1000).toISOString()}))} : undefined}};
}
