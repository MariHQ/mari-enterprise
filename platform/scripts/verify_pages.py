#!/usr/bin/env python3
"""Read-only API smoke checks, bounded pages, and timings without browser capture."""
import argparse
import json
import os
import time
import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8081')
    args = parser.parse_args()
    failures = []
    with httpx.Client(base_url=args.url, timeout=40) as client:
        response = client.post('/auth/login', json={
            'email': os.getenv('MARI_CHECK_USER', 'demo'),
            'password': os.getenv('MARI_CHECK_PASSWORD', 'demo')})
        response.raise_for_status()

        def check(path, params=None, expected=200):
            start = time.monotonic()
            try:
                response = client.get(path, params=params)
                elapsed = round(time.monotonic() - start, 3)
                print(json.dumps({'path': path, 'status': response.status_code, 'seconds': elapsed, 'records': len(response.json().get('records', []))}), flush=True)
                if response.status_code != expected:
                    failures.append(f'{path}: HTTP {response.status_code}, expected {expected}')
                    return None
                return response.json()
            except httpx.HTTPError as error:
                failures.append(f'{path}: {type(error).__name__}')
                return None

        for path in ('/api/connectors', '/api/operations', '/api/overview'):
            body = check(path)
            if body is not None and path == '/api/connectors' and not any(row['kind'] in ('temporal_connector', 'webhook_connector') for row in body.get('records', [])):
                failures.append('Sources: no connector configuration returned')
            if body is not None and path == '/api/operations' and not any(row['kind'] == 'temporal_schedule' for row in body.get('records', [])):
                failures.append('Schedules: no schedule records returned')
        for path in ('/api/records', '/api/search'):
            body = check(path, {'q': 'kafka'}, 409)
            if body and 'GRAPH_REQUIREMENTS:' not in body.get('detail', ''):
                failures.append(f'{path}: missing search-edge requirement')
        check('/api/lineage', expected=422)
        first = check('/api/records', {'limit': 40, 'summary': 'true'})
        if first is not None:
            if 'total' in first or len(first['records']) > 40:
                failures.append('KB: unexpected total or oversized page')
            if any(row['source'] == 'temporal' or row['kind'] in ('edge', 'workflow', 'mining_receipt') for row in first['records']):
                failures.append('KB: contains operational or edge records')
            if first.get('has_more'):
                second = check('/api/records', {'limit': 40, 'summary': 'true', 'cursor': first['next_cursor']})
                if second and ({row['record_id'] for row in first['records']} & {row['record_id'] for row in second['records']}):
                    failures.append('KB: cursor pages overlap')
            if first['records']:
                graph = check('/api/lineage', {'focal': first['records'][0]['record_id'], 'limit': 10})
                if graph and (len(graph['edges']) > 10 or len(graph['records']) > 11):
                    failures.append('Lineage: exceeded neighborhood bound')
        # Repeat bounded reads to distinguish cold planning from warm reads.
        check('/api/connectors')
        check('/api/records', {'limit': 40, 'summary': 'true'})
    print(json.dumps({'passed': not failures, 'failures': failures}))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
