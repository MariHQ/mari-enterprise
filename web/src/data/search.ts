import type { SearchResultGroup, SearchScope } from '@mari-design/components/navigation/GlobalSearch';
import { request, type RecordData } from './platform';
export const SEARCH_SCOPES: SearchScope[] = [{id:'docs', label:'Documents'}];
export async function globalSearch(query: string): Promise<SearchResultGroup[]> {
  const {records} = await request<{records:RecordData[]}>(`/api/records?q=${encodeURIComponent(query)}&limit=12`);
  return [{scope:SEARCH_SCOPES[0], results:records.map(r => ({id:r.record_id, scope:'docs',
    title:r.title, subtitle:r.text.slice(0,200), href:`/knowledge/doc?id=${encodeURIComponent(r.record_id)}`}))}];
}
