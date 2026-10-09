import { request, type RecordData } from '@mari-app/records';
// Original component actions carry one ID; retain its table as part of that identity.
export const identity = (row: Pick<RecordData, 'table' | 'record_id'>) => JSON.stringify([row.table, row.record_id]);
export function address(value: string | number) {
  const [table, id] = JSON.parse(String(value));
  if (typeof table !== 'string' || typeof id !== 'string') throw new Error('Missing record table');
  return { table, id };
}
export function recordUrl(value: string | number) {
  const { table, id } = address(value);
  return `/api/record?${new URLSearchParams({table,id})}`;
}
export const current = (value: string | number) => request<RecordData>(recordUrl(value));

export function nodeType(value: string | number) {
  const {table} = address(value);
  return table.split('.').slice(2).join('_').split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('');
}
